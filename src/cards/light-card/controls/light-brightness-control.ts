import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { HomeAssistant, isActive, isAvailable, LightEntity } from "../../../ha";
import "../../../shared/slider";
import { getBrightness } from "../utils";
import { forwardHaptic } from "../../../ha/data/haptics";

@customElement("mushroom-light-brightness-control")
export class LightBrighnessControl extends LitElement {
    @property({ attribute: false }) public hass!: HomeAssistant;
    
    @property({ attribute: false }) public entity!: LightEntity;

    _timer?: number;
    _percent?: number;
    
    onChange(e: CustomEvent<{ value: number }>): void {
        const value: number = e.detail.value;

        if(this._percent != value && !(this._percent == 1 && value < 1))
        {
            this._percent = value;
            
            // Disable 0% brightness
            if(value == 0) this._percent = 1;

            this.hass.callService("light", "turn_on", {
                entity_id: this.entity.entity_id,
                brightness_pct: this._percent,
            });

            forwardHaptic("selection");
        }
    }

    onCurrentChange(e: CustomEvent<{ value?: number }>): void {
        const value: number | undefined = e.detail.value;

        if(value && this._percent != value)
        {
            if (this._timer) clearTimeout(this._timer);
            
            this._percent = value;
            
            // Disable 0% brightness
            if(value == 0) this._percent = 1;

            this.dispatchEvent(
                new CustomEvent("current-change", {
                    detail: {
                        value,
                    },
                })
            );
            
            // Set timer to prevent delay issues
            this._timer = window.setTimeout(() => { 
                this.hass.callService("light", "turn_on", {
                    entity_id: this.entity.entity_id,
                    brightness_pct: this._percent,
                });

                this._timer = undefined;
            }, 25);

            forwardHaptic("light");
        }
    }

    finished(): void {
        this._percent = undefined;
    }

    protected render(): TemplateResult {
        const brightnessPercent = this._percent || getBrightness(this.entity);

        return html`
            <mushroom-slider
                .isBrightness=${true}
                .value=${brightnessPercent}
                .disabled=${!isAvailable(this.entity)}
                .inactive=${!isActive(this.entity)}
                .showActive=${true}
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
