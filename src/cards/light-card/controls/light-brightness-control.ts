import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { HomeAssistant, isActive, isAvailable, LightEntity } from "../../../ha";
import "../../../shared/slider";
import { delay, getBrightness } from "../utils";
import { FINISHED_FEEDBACK_DELAY, LIVE_FEEDBACK_DELAY } from "../const";

@customElement("mushroom-light-brightness-control")
export class LightBrighnessControl extends LitElement {
    @property({ attribute: false }) public hass!: HomeAssistant;

    @property({ attribute: false }) public entity!: LightEntity;

    private _timer?: number;
    private _percent?: number;

    private _dispatchCurrentBrightness(value: number): void {
        this.dispatchEvent(
            new CustomEvent("current-change", {
                detail: {
                    value,
                },
            })
        );
    } 

    onChange(e: CustomEvent<{ value: number }>): void {
        const value: number = e.detail.value;
        if (this._percent == value) return;

        //Make sure the current brightness state is changed
        this._dispatchCurrentBrightness(value);

        this._percent = value;
        
        //Check if current change timer is active
        if (this._timer) 
        {
            clearTimeout(this._timer);
            this._timer = undefined;
        }

        this.hass.callService("light", "turn_on", {
            entity_id: this.entity.entity_id,
            brightness_pct: this._percent,
        });
    }

    onCurrentChange(e: CustomEvent<{ value?: number }>): void {
        const value: number | undefined = e.detail.value;
        if (value == null || this._percent == value) return;
        if (this._timer) clearTimeout(this._timer);

        //Make sure the current brightness state is changed
        this._dispatchCurrentBrightness(value);

        // Set timer to prevent delay issues
        this._timer = window.setTimeout(() => {
            this._percent = value;

            this.hass.callService("light", "turn_on", {
                entity_id: this.entity.entity_id,
                brightness_pct: this._percent,
            });

            this._timer = undefined;
        }, LIVE_FEEDBACK_DELAY);
    }

    finished(): void {
        delay(FINISHED_FEEDBACK_DELAY).then(() => {
            this._percent = undefined;
        });
    }

    protected render(): TemplateResult {
        let brightnessPercent = this._percent || getBrightness(this.entity);

        //mushroom-slider .value this._percent != undefined prevent live changing conflicts
        return html`
            <mushroom-slider
                .isBrightness=${true}
                .value=${this._percent != undefined ? undefined : brightnessPercent}
                .disabled=${!isAvailable(this.entity)}
                .inactive=${!isActive(this.entity)}
                .showActive=${true}
                .holdPanMove=${true}
                icon="mdi:brightness-6"
                @change=${this.onChange}
                @current-change=${this.onCurrentChange}
                @finished=${this.finished}
            />
        `;
    }

    static get styles(): CSSResultGroup {
        return css`
            :host {
                --slider-color: rgb(var(--rgb-state-light));
                --slider-outline-color: transparent;
                --slider-bg-color: rgba(var(--rgb-state-light), 0.2);
            }
            mushroom-slider {
                --main-color: var(--slider-color);
                --bg-color: var(--slider-bg-color);
                --main-outline-color: var(--slider-outline-color);
            }
        `;
    }
}
