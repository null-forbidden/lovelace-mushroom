import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { HomeAssistant, isActive, isAvailable, LightEntity } from "../../../ha";
import "../../../shared/slider";
import { delay, getColorTemp } from "../utils";
import { forwardHaptic } from "../../../ha/data/haptics";
import { FINISHED_FEEDBACK_DELAY, LIVE_FEEDBACK_DELAY } from "../const";

@customElement("mushroom-light-color-temp-control")
export class LightColorTempControl extends LitElement {
    @property({ attribute: false }) public hass!: HomeAssistant;

    @property({ attribute: false }) public entity!: LightEntity;

    private _timer?: number;
    private _percent?: number;

    onChange(e: CustomEvent<{ value: number }>): void {
        const value: number = e.detail.value;
        if (this._percent == value) return;

        this._percent = value;
        
        //Check if current change timer is active
        if (this._timer) 
        {
            clearTimeout(this._timer);
            this._timer = undefined;
        }

        this.hass.callService("light", "turn_on", {
            entity_id: this.entity.entity_id,
            color_temp: this._percent,
        });
    }

    onCurrentChange(e: CustomEvent<{ value?: number }>): void {
        const value: number | undefined = e.detail.value;
        if (value == null || this._percent == value) return;
        if (this._timer) clearTimeout(this._timer);

        // Set timer to prevent delay issues
        this._timer = window.setTimeout(() => {
            this._percent = value;

            this.hass.callService("light", "turn_on", {
                entity_id: this.entity.entity_id,
                color_temp: this._percent,
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
        const colorTempPercent = this._percent || getColorTemp(this.entity);

        //mushroom-slider .value this._percent != undefined prevent live changing conflicts
        return html`
            <mushroom-slider
                .value=${this._percent != undefined ? undefined : colorTempPercent}
                .disabled=${!isAvailable(this.entity)}
                .inactive=${!isActive(this.entity)}
                .min=${this.entity.attributes.min_mireds ?? 0}
                .max=${this.entity.attributes.max_mireds ?? 100}
                .showIndicator=${true}
                icon="mdi:thermometer"
                @change=${this.onChange}
                @current-change=${this.onCurrentChange}
                @finished=${this.finished}
            />
        `;
    }

    static get styles(): CSSResultGroup {
        return css`
            mushroom-slider {
                --gradient: -webkit-linear-gradient(right, rgb(255, 160, 0) 0%, white 100%);
            }
        `;
    }
}
