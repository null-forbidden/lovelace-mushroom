import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { HomeAssistant, isActive, isAvailable, LightEntity } from "../../../ha";
import "../../../shared/slider";
import { getColorTemp } from "../utils";
import { forwardHaptic } from "../../../ha/data/haptics";

@customElement("mushroom-light-color-temp-control")
export class LightColorTempControl extends LitElement {
    @property({ attribute: false }) public hass!: HomeAssistant;

    @property({ attribute: false }) public entity!: LightEntity;

    _timer!: NodeJS.Timeout | null;
    _percent!: number;

    onChange(e: CustomEvent<{ value: number }>): void {
        const value: number = e.detail.value;

        if(this._percent != value)
        {
            this._percent = value;

            this.hass.callService("light", "turn_on", {
                entity_id: this.entity.entity_id,
                color_temp: this._percent,
            });

            forwardHaptic("light");
        }
    }

    onCurrentChange(e: CustomEvent<{ value?: number }>): void {
        const value: number | undefined = e.detail.value;

        if(value && this._percent != value)
        {
            if (this._timer) clearTimeout(this._timer);

            this._percent = value;

            // Set timer to prevent delay issues
            this._timer = setTimeout(() => {    
                this.hass.callService("light", "turn_on", {
                    entity_id: this.entity.entity_id,
                    color_temp: this._percent,
                });
                this._timer = null;
            }, 25);
            
            forwardHaptic("light");
        }
    }

    protected render(): TemplateResult {
        const colorTempPercent = this._percent || getColorTemp(this.entity);

        return html`
            <mushroom-slider
                .value=${colorTempPercent}
                .disabled=${!isAvailable(this.entity)}
                .inactive=${!isActive(this.entity)}
                .min=${this.entity.attributes.min_mireds ?? 0}
                .max=${this.entity.attributes.max_mireds ?? 100}
                .showIndicator=${true}
                @change=${this.onChange}
                @current-change=${this.onCurrentChange}
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
