import { css, CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import { HomeAssistant, isActive, isAvailable, LightEntity } from "../../../ha";
import "../../../shared/slider";
import { forwardHaptic } from "../../../ha/data/haptics";
import { delay, getColorSaturation } from "../utils";
import { FINISHED_FEEDBACK_DELAY, LIVE_FEEDBACK_DELAY } from "../const";

@customElement("mushroom-light-color-saturation-control")
export class LightColorControl extends LitElement {
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

        const hue_color = this.entity.attributes.hs_color[0];

        this.hass.callService("light", "turn_on", {
            entity_id: this.entity.entity_id,
            hs_color: [hue_color, this._percent],
        });
    }

    onCurrentChange(e: CustomEvent<{ value?: number }>): void {
        const value: number | undefined = e.detail.value;
        if (value == null || this._percent == value) return;
        if (this._timer) clearTimeout(this._timer);

        // Set timer to prevent delay issues
        this._timer = window.setTimeout(() => {
            this._percent = value;

            const hue_color = this.entity.attributes.hs_color[0];

            this.hass.callService("light", "turn_on", {
                entity_id: this.entity.entity_id,
                hs_color: [hue_color, this._percent],
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
        const colorPercent = this._percent || getColorSaturation(this.entity);

        //mushroom-slider .value this._percent != undefined prevent live changing conflicts
        return html`
            <mushroom-slider
                .value=${this._percent != undefined ? undefined : colorPercent}
                .disabled=${!isAvailable(this.entity)}
                .inactive=${!isActive(this.entity)}
                .min=${45}
                .max=${100}
                .showIndicator=${true}
                icon="mdi:invert-colors"
                @change=${this.onChange}
                @current-change=${this.onCurrentChange}
                @finished=${this.finished}
            />
        `;
    }

    static get styles(): CSSResultGroup {
        return css`
            mushroom-slider {
                --gradient: -webkit-linear-gradient(right, var(--fixed-color) 0%, white 150%);
            }
        `;
    }
}
