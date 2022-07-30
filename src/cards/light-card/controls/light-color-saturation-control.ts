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

    _timer?: number;
    _percent?: number;

    onChange(e: CustomEvent<{ value: number }>): void {
        const value: number = e.detail.value;

        if (this._percent != value) {
            this._percent = value;

            const hue_color = this.entity.attributes.hs_color[0];

            console.log(this.entity)

            this.hass.callService("light", "turn_on", {
                entity_id: this.entity.entity_id,
                hs_color: [hue_color, this._percent],
            });

            forwardHaptic("selection");
        }
    }

    onCurrentChange(e: CustomEvent<{ value?: number }>): void {
        const value: number | undefined = e.detail.value;

        if (value && this._percent != value) {
            if (this._timer) clearTimeout(this._timer);

            this._percent = value;

            // Set timer to prevent delay issues
            this._timer = window.setTimeout(() => {
                const hue_color = this.entity.attributes.hs_color[0];
    
                this.hass.callService("light", "turn_on", {
                    entity_id: this.entity.entity_id,
                    hs_color: [hue_color, this._percent],
                });

                this._timer = undefined;
            }, LIVE_FEEDBACK_DELAY);

            forwardHaptic("selection");
        }
    }

    finished(): void {
        delay(FINISHED_FEEDBACK_DELAY).then(() => {
            this._percent = undefined;

            forwardHaptic("success");
        });
    }

    protected render(): TemplateResult {
        const colorPercent = this._percent || getColorSaturation(this.entity);

        return html`
            <mushroom-slider
                .value=${colorPercent}
                .disabled=${!isAvailable(this.entity)}
                .inactive=${!isActive(this.entity)}
                .min=${10}
                .max=${100}
                .showIndicator=${true}
                @change=${this.onChange}
                @current-change=${this.onCurrentChange}
                @finished=${this.finished}
            />
        `;
    }

    static get styles(): CSSResultGroup {
        return css`
            mushroom-slider {
                --gradient: -webkit-linear-gradient(right, var(--fixed-color) 0%, white 125%);
            }
        `;
    }
}
