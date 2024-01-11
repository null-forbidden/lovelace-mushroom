import { css, CSSResultGroup, html, LitElement, PropertyValues, TemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import "hammerjs";
import { FINISHED_FEEDBACK_DELAY, LIVE_FEEDBACK_DELAY, OVERLAY_DELAY } from "../cards/light-card/const";
import { isMobile } from "../utils/mobile";
import { forwardHaptic } from "../ha";
import { delay } from "../cards/light-card/utils";

const getPercentageFromEvent = (e: HammerInput) => {
    const x = e.center.x;
    const offset = e.target.getBoundingClientRect().left;
    const total = e.target.clientWidth;
    return Math.max(Math.min(1, (x - offset) / total), 0);
};

export const DEFAULT_SLIDER_THRESHOLD = 10;
const getSliderThreshold = (element: any): number | undefined => {
    const thresholdValue = window.getComputedStyle(element).getPropertyValue("--slider-threshold");
    const threshold = parseFloat(thresholdValue);
    return isNaN(threshold) ? DEFAULT_SLIDER_THRESHOLD : threshold;
};

@customElement("mushroom-slider")
export class SliderItem extends LitElement {
    @property({ type: String }) public icon: string | null = null;

    @property({ type: Boolean }) public disabled: boolean = false;

    @property({ type: Boolean }) public inactive: boolean = false;

    @property({ type: Boolean, attribute: "show-active" })
    public showActive?: boolean;

    @property({ type: Boolean, attribute: "show-indicator" })
    public showIndicator?: boolean;

    @property({ attribute: false, type: Number, reflect: true })
    public value?: number;

    @property({ type: Number })
    public step: number = 1;

    @property({ type: Number })
    public min: number = 0;

    @property({ type: Number })
    public max: number = 100;

    @property({ type: Boolean })
    public isBrightness: boolean = false;

    private _mc?: HammerManager;

    private _overlayEnabled: boolean = false;
    @state() private _showOverlay: boolean = false;

    private _overlayTimer?: number;
    
    @state() controlled: boolean = false;

    private _isMobile: boolean = false;

    private _onOverlayTap(e): void {
        forwardHaptic("medium");
        e.stopPropagation();
        this.setOverlayTimer();
    }

    private onChange(): void {
        if(this._overlayTimer)
        {
            clearTimeout(this._overlayTimer);
        }
        this.setOverlayTimer();
    }

    private setOverlayTimer(): void {
        this._showOverlay = false;
        this._overlayTimer = window.setTimeout(() => {
            this._showOverlay = true
            this._overlayTimer = undefined;
        }, OVERLAY_DELAY);
    }

    valueToPercentage(value: number) {
        return (value - this.min) / (this.max - this.min);
    }

    percentageToValue(value: number) {
        return (this.max - this.min) * value + this.min;
    }

    protected firstUpdated(changedProperties: PropertyValues): void {
        super.firstUpdated(changedProperties);
        this.initialize();
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.initialize();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.destroyListeners();
    }

    @query("#slider")
    private slider;

    @property({ type: Boolean }) public holdPanMove: boolean = false;
    private currentPercentageValue?: number;
    private newPercentageValue?: number;
    private percentageToHoldPan: number[] = [25, 50, 75];
    private holdPan: boolean = false;

    private _isScrolling: boolean = false;
    private _huiMasonryView: HTMLElement | null = null;

    bugFixAttempt() {
        if(!this._huiMasonryView) return;

        let scrollTimeout;
        this._huiMasonryView.onscroll = () =>
        {
            this._isScrolling = true;
            this.destroyListeners()
            clearTimeout(scrollTimeout);

            scrollTimeout = setTimeout(() => {
                this._isScrolling = false;
                this.setupListeners();
            }, 100);
        }
    }

    initialize() {
        const ha = document.querySelector("home-assistant");
        const main = ha?.shadowRoot?.querySelector("home-assistant-main")?.shadowRoot;
        const lovelace = main?.querySelector("ha-panel-lovelace");
        const huiRoot = lovelace?.shadowRoot?.querySelector("hui-root")?.shadowRoot;
        const huiMasonryView = huiRoot?.querySelector("hui-masonry-view");

        this.setupListeners();

        this._isMobile = !!isMobile();
        this._huiMasonryView = huiMasonryView as HTMLElement;

        this._overlayEnabled = this._isMobile;
        this._showOverlay = this._overlayEnabled;      
    }

    setupListeners() {
        if (!this.slider || this._mc) return;

        const threshold = getSliderThreshold(this.slider);
        const pan = new Hammer.Pan({
            threshold,
            direction: Hammer.DIRECTION_HORIZONTAL,
            enable: true,
        });
        const tap = new Hammer.Tap({ 
            event: "singletap",
            taps: 1 
        });

        this._mc = new Hammer.Manager(this.slider, { touchAction: "pan-y" });
        this._mc.add([
            pan,
            tap
        ]);

        this._mc.on("panstart", () => {
            if (this.disabled) return;
            this.bugFixAttempt();
            this.controlled = true;
        });

        this._mc.on("pancancel", () => {
            if (this.disabled) return;
            this.controlled = false;
        });

        let panMoveTimeout;
        this._mc.on("panmove", (e) => {
            // delay(LIVE_FEEDBACK_DELAY, this._isMobile).then(() => {
                if (this.disabled) return;
                if (this._isScrolling) return;

                if (this._overlayEnabled) this.onChange();

                //Make sure to disable scroll while panmove on mobile
                if (this._isMobile && this._huiMasonryView) 
                {
                    this._huiMasonryView.style.overflowY = "hidden";
                    clearTimeout(panMoveTimeout);

                    panMoveTimeout = setTimeout(() => {
                        this._huiMasonryView!.style.overflowY = "auto";
                    }, FINISHED_FEEDBACK_DELAY);
                }

                const percentage = getPercentageFromEvent(e);
                this.currentPercentageValue = (Math.round(this.percentageToValue(percentage) / this.step) * this.step)

                // Disable 0% brightness
                if (this.isBrightness && this.currentPercentageValue == 0) this.currentPercentageValue = 1;
                if (this.currentPercentageValue == this.value) return;
                if (resumePanMove()) this.holdPan = false;
                if (this.holdPan) return;

                this.value = this.currentPercentageValue;
                this.newPercentageValue = this.currentPercentageValue;

                if (this.value != null)
                {
                    //Hold pan when certain percentage reached
                    if (this.holdPanMove && this.percentageToHoldPan.includes(this.value))
                    {
                        this.holdPan = true;
                        forwardHaptic("heavy");
                    }
                    //Give haptic feedback when 1 or 100 precentage reached
                    else if(this.isBrightness && (this.value == 1 || this.value == 100)) 
                    {
                        forwardHaptic("heavy");
                    } else {
                        forwardHaptic("selection");
                    }

                    //Set value
                    this.dispatchEvent(
                        new CustomEvent("current-change", {
                            detail: {
                                value: this.value,
                            },
                        })
                    );
                }
            // });
        });

        this._mc.on("panend", (e) => {
            if (this.disabled) return;

            this.controlled = false;

            let percentageValue: number | undefined = this.value;

            //Check if it was on hold pan
            if (this.holdPan) 
            {
                this.holdPan = false;
            }
            //If not set the new value
            else
            {
                const percentage = getPercentageFromEvent(e);
                // Prevent from input releasing on a value that doesn't lie on a step
                percentageValue = Math.round(this.percentageToValue(percentage) / this.step) * this.step;
            }

            dispatchNewValue(percentageValue);
        });

        this._mc.on("singletap", (e) => {
            if (this.disabled) return;
            if (this._overlayEnabled) this.onChange();

            const percentage = getPercentageFromEvent(e);
            // Prevent from input selecting a value that doesn't lie on a step
            const percentageValue = Math.round(this.percentageToValue(percentage) / this.step) * this.step;

            dispatchNewValue(percentageValue);
        });

        const dispatchNewValue: Function = (percentageValue: number) => {
            // Disable 0% brightness
            if (this.isBrightness && percentageValue == 0) percentageValue = 1;

            this.currentPercentageValue = percentageValue;
            this.newPercentageValue = percentageValue;
            this.value = percentageValue;

            this.dispatchEvent(
                new CustomEvent("change", {
                    detail: {
                        value: percentageValue,
                    },
                })
            );
            this.dispatchEvent(new CustomEvent("finished"));

            forwardHaptic("success");
        }

        const resumePanMove: Function = (): boolean => {
            const percentageRelease = 10;

            return this.currentPercentageValue != null && 
            this.newPercentageValue != null && 
            this.holdPan && 
            (this.currentPercentageValue >= (this.newPercentageValue + percentageRelease) || 
                this.currentPercentageValue <= (this.newPercentageValue - percentageRelease))
        }
    }

    destroyListeners() {
        if (this._mc) {
            this._mc.destroy();
            this._mc = undefined;
        }
    }

    protected render(): TemplateResult {
        return html`
            <div
                class=${classMap({
                    container: true,
                    inactive: this.inactive || this.disabled,
                    controlled: this.controlled,
                })}
            >
                ${this._showOverlay ? html`<div class="overlay" @click=${(e) => this._onOverlayTap(e)}><ha-icon class="icon" icon="mdi:lock" /></div>` : null}
                <div
                    id="slider"
                    class="slider"
                    style=${styleMap({
                        "--value": `${this.valueToPercentage(this.newPercentageValue ?? this.currentPercentageValue ?? this.value ?? 0)}`,
                    })}
                > 
                    <div class="slider-track-background"></div>
                    ${this.showActive ? html`<div class="slider-track-active"></div>` : null}
                    ${this.showIndicator ? html`<div class="slider-track-indicator"></div>` : null}
                    ${this.icon && !this._showOverlay ? html`<ha-icon class="slider-track-icon" .icon=${this.icon}></ha-icon>`: null}
                </div>
            </div>
        `;
    }

    static get styles(): CSSResultGroup {
        return css`
            .overlay {
                display: flex;
                justify-content: center;
                align-items: center;
                border-radius: var(--control-border-radius);
                position: absolute;
                width: 100%;
                height: 100%;
                background: rgb(0, 0, 0, 0.50);
                z-index: 1;
            }
            .overlay .icon {
                opacity: 0.75;
            }

            :host {
                --main-color: rgba(var(--rgb-secondary-text-color), 1);
                --bg-gradient: none;
                --bg-color: rgba(var(--rgb-secondary-text-color), 0.2);
                --main-color-inactive: rgb(var(--rgb-disabled));
                --bg-color-inactive: rgba(var(--rgb-disabled), 0.2);
            }
            .container {
                display: flex;
                flex-direction: row;
                height: calc(var(--control-height) * 1.5);
                position: relative;
            }
            .slider {
                position: relative;
                height: 100%;
                width: 100%;
                border-radius: var(--control-border-radius);
                transform: translateZ(0);
                overflow: hidden;
                cursor: pointer;
            }
            .slider * {
                pointer-events: none;
            }
            .slider .slider-track-background {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: 100%;
                background-color: var(--bg-color);
                background-image: var(--gradient);
            }
            .slider .slider-track-active {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: 100%;
                transform: scale3d(var(--value, 0), 1, 1);
                transform-origin: left;
                background-color: var(--main-color);
                transition: transform 180ms ease-in-out;
            }
            .slider .slider-track-indicator {
                position: absolute;
                top: 0;
                bottom: 0;
                left: calc(var(--value, 0) * (100% - 10px));
                width: 10px;
                border-radius: 3px;
                background-color: white;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
                transition: left 180ms ease-in-out;
            }
            .slider .slider-track-indicator:after {
                display: block;
                content: "";
                background-color: var(--main-color);
                position: absolute;
                top: 0;
                left: 0;
                bottom: 0;
                right: 0;
                margin: auto;
                height: 20px;
                width: 2px;
                border-radius: 1px;
            }
            .slider .slider-track-icon {
                text-align: center;
                position: absolute;
                top: 50%;
                left: 0;
                right: 0;
                margin: auto;
                transform: translateY(-50%);
            }
            .inactive .slider .slider-track-background {
                background-color: var(--bg-color-inactive);
                background-image: none;
            }
            .inactive .slider .slider-track-indicator:after {
                background-color: var(--main-color-inactive);
            }
            .inactive .slider .slider-track-active {
                background-color: var(--main-color-inactive);
            }
            .controlled .slider .slider-track-active {
                transition: none;
            }
            .controlled .slider .slider-track-indicator {
                transition: none;
            }
        `;
    }
}
