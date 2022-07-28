import * as Color from "color";
import { HassEntity } from "home-assistant-js-websocket";
import { css, CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import { HomeAssistant, isActive, isAvailable } from "../../../ha";
import "../../../shared/slider";
import { forwardHaptic } from "../../../ha/data/haptics";

const GRADIENT = [
    [0, "#f00"],
    [0.17, "#ff0"],
    [0.33, "#0f0"],
    [0.5, "#0ff"],
    [0.66, "#00f"],
    [0.83, "#f0f"],
    [1, "#f00"],
];

@customElement("mushroom-light-color-control")
export class LightColorControl extends LitElement {
    @property({ attribute: false }) public hass!: HomeAssistant;

    @property({ attribute: false }) public entity!: HassEntity;

    _timer!: NodeJS.Timeout | null;
    _percent!: number;

    _percentToRGB(percent: number): number[] {
        const color = Color.hsv(360 * percent, 100, 100);
        return color.rgb().array();
    }

    _rgbToPercent(rgb: number[]): number {
        const color = Color.rgb(rgb);
        return color.hsv().hue() / 360;
    }

    onChange(e: CustomEvent<{ value: number }>): void {
        const value: number = e.detail.value;

        if(this._percent != value)
        {
            this._percent = value;

            const rgb_color = this._percentToRGB(this._percent / 100);

            if (rgb_color.length === 3) {
                this.hass.callService("light", "turn_on", {
                    entity_id: this.entity.entity_id,
                    rgb_color,
                });

                forwardHaptic("selection");
            }
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
                const rgb_color = this._percentToRGB(this._percent / 100);
        
                if (rgb_color.length === 3) {
                    this.hass.callService("light", "turn_on", {
                        entity_id: this.entity.entity_id,
                        rgb_color,
                    });
                }

                this._timer = null;
            }, 25);

            forwardHaptic("selection");
        }
    }

    protected render(): TemplateResult {
        const colorPercent =
            this._percent || this._rgbToPercent(this.entity.attributes.rgb_color) * 100;

        return html`
            <mushroom-slider
                .value=${colorPercent}
                .disabled=${!isAvailable(this.entity)}
                .inactive=${!isActive(this.entity)}
                .min=${0}
                .max=${100}
                .showIndicator=${true}
                @change=${this.onChange}
                @current-change=${this.onCurrentChange}
            />
        `;
    }

    static get styles(): CSSResultGroup {
        const gradient = GRADIENT.map(
            ([stop, color]) => `${color} ${(stop as number) * 100}%`
        ).join(", ");
        return css`
            mushroom-slider {
                --gradient: -webkit-linear-gradient(left, ${unsafeCSS(gradient)});
            }
        `;
    }
}
