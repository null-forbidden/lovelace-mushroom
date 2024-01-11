import { css, CSSResultGroup, html, PropertyValues, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import {
    actionHandler,
    ActionHandlerEvent,
    computeRTL,
    computeStateDisplay,
    handleAction,
    hasAction,
    HomeAssistant,
    isActive,
    LightColorModes,
    LightEntity,
    LovelaceCard,
    LovelaceCardEditor,
} from "../../ha";
import "../../shared/badge-icon";
import "../../shared/button";
import "../../shared/card";
import "../../shared/shape-avatar";
import "../../shared/shape-icon";
import "../../shared/state-info";
import "../../shared/state-item";
import { computeAppearance } from "../../utils/appearance";
import { MushroomBaseCard } from "../../utils/base-card";
import { cardStyle } from "../../utils/card-styles";
import { registerCustomCard } from "../../utils/custom-cards";
import { stateIcon } from "../../utils/icons/state-icon";
import { computeEntityPicture } from "../../utils/info";
import { FINISHED_FEEDBACK_DELAY, LIGHT_CARD_EDITOR_NAME, LIGHT_CARD_NAME, LIGHT_ENTITY_DOMAINS } from "./const";
import "./controls/light-brightness-control";
import "./controls/light-color-control";
import "./controls/light-color-temp-control";
import "./controls/light-color-saturation-control";
import { LightCardConfig } from "./light-card-config";
import {
    getBrightness,
    getRGBColor,
    isColorLight,
    isColorSuperLight,
    supportsBrightnessControl,
    supportsColorControl,
    supportsColorSaturationControl,
    supportsColorTempControl,
} from "./utils";
import { forwardHaptic } from "../../ha/data/haptics";
import * as Color from "color";

type LightCardControl = "all_controls" | "brightness_control" | "color_temp_control" | "color_control";

const CONTROLS_ICONS: Record<LightCardControl, string> = {
    all_controls: "mdi:expand-all",
    brightness_control: "mdi:brightness-4",
    color_temp_control: "mdi:thermometer",
    color_control: "mdi:palette"
};

registerCustomCard({
    type: LIGHT_CARD_NAME,
    name: "Mushroom Light Card",
    description: "Card for light entity",
});

@customElement(LIGHT_CARD_NAME)
export class LightCard extends MushroomBaseCard implements LovelaceCard {
    public static async getConfigElement(): Promise<LovelaceCardEditor> {
        await import("./light-card-editor");
        return document.createElement(LIGHT_CARD_EDITOR_NAME) as LovelaceCardEditor;
    }

    public static async getStubConfig(hass: HomeAssistant): Promise<LightCardConfig> {
        const entities = Object.keys(hass.states);
        const lights = entities.filter((e) => LIGHT_ENTITY_DOMAINS.includes(e.split(".")[0]));
        return {
            type: `custom:${LIGHT_CARD_NAME}`,
            entity: lights[0],
        };
    }

    @state() private _config?: LightCardConfig;

    @state() private _activeControl?: LightCardControl;

    @state() private _controls: LightCardControl[] = [];

    @state() public showSliderOverlay: boolean = false;

    private _savedColorTemp?: number;

    private _savedHSColor?: number[];

    @state() private _showControls: boolean = false;

    @state() private _showSaturation: boolean = false;

    _onControlTap(ctrl: LightCardControl, e): void {
        e.stopPropagation();
        forwardHaptic("medium");
        
        if(this._config && this._config.entity && !this._config.disable_auto_switch_mode && (ctrl == "color_temp_control" || ctrl == "color_control"))
        {
            const entity_id = this._config.entity;
            const entity = this.hass.states[entity_id] as LightEntity;

            if(entity.attributes.color_mode == LightColorModes.COLOR_TEMP) {
                this._savedColorTemp = entity.attributes.color_temp;
            } else if(entity.attributes.color_mode == LightColorModes.HS) {
                this._savedHSColor = entity.attributes.hs_color;
            }

            let data: Record<string, any> = { entity_id: this._config.entity };

            if(ctrl == "color_temp_control") {
                if(this._config.default_kelvin) {
                    data["kelvin"] = this._config.default_kelvin;
                } else if(this._savedColorTemp) {
                    data["color_temp"] = this._savedColorTemp;
                } else {
                    data["color_temp"] = (entity.attributes.max_mireds * 0.925);
                }
            } else if(ctrl == "color_control") {                
                if(this._config.default_rgb) {
                    data["rgb_color"] = this._config.default_rgb;
                } else if(this._savedHSColor) {
                    data["hs_color"] = this._savedHSColor;
                } else {
                    data["rgb_color"] = entity.attributes.rgb_color;
                }
            }
            
            this.hass.callService("light", "turn_on", data);
        }

        if(this._config?.disable_auto_switch_mode) this._activeControl = ctrl;
    }

    getCardSize(): number | Promise<number> {
        return 1;
    }

    setConfig(config: LightCardConfig): void {
        this._config = {
            tap_action: {
                action: "toggle",
            },
            hold_action: {
                action: "more-info",
            },
            ...config,
        };
        this.updateControls();
        this.updateBrightness();
    }

    protected updated(changedProperties: PropertyValues) {
        super.updated(changedProperties);
        if (this.hass && changedProperties.has("hass")) {
            this.updateControls();
            this.updateBrightness();
        }
    }

    @state() private brightness?: number = undefined;
    private _onCurrentBrightnessTimeout?: number;
    private _isOnCurrentBrightnessChange: boolean = false;

    updateBrightness() {
        if (!this._config || !this.hass || !this._config.entity) return;

        const entity_id = this._config.entity;
        const entity = this.hass.states[entity_id] as LightEntity;

        if (!entity) return;
        if(this._isOnCurrentBrightnessChange) return;

        const currentBrithness = getBrightness(entity);
        this.brightness = currentBrithness;
    }

    private onCurrentBrightnessChange(e: CustomEvent<{ value?: number }>): void {
        if (e.detail.value == null) return;   
        if(this._onCurrentBrightnessTimeout) clearTimeout(this._onCurrentBrightnessTimeout);
        this._isOnCurrentBrightnessChange = true;

        this.brightness = e.detail.value;
    
        this._onCurrentBrightnessTimeout = window.setTimeout(() => {
            this._isOnCurrentBrightnessChange = false;
            this._onCurrentBrightnessTimeout = undefined;
        }, FINISHED_FEEDBACK_DELAY);

    }

    updateControls() {
        if (!this._config || !this.hass || !this._config.entity) return;

        const entity_id = this._config.entity;
        const entity = this.hass.states[entity_id] as LightEntity;

        if (!entity) return;

        const controls: LightCardControl[] = [];
        if (!this._config.collapsible_controls || isActive(entity)) {
            if (this._config.show_brightness_control && supportsBrightnessControl(entity) && !supportsColorTempControl(entity) && !supportsColorControl(entity)) {
                controls.push("brightness_control");
            }
            if (this._config.show_color_temp_control && supportsColorTempControl(entity)) {
                controls.push("color_temp_control");
            }
            if (this._config.show_color_control && supportsColorControl(entity)) {
                controls.push("color_control");
            }
            if (this._config.show_all_controls && (supportsBrightnessControl(entity) || supportsColorTempControl(entity) || supportsColorControl(entity) || supportsColorSaturationControl(entity))) {
                controls.push("all_controls");
            }
        }

        this._controls = controls;

        //Return when there are not controls
        if (controls.length <= 0) return;
        
        if(!this._activeControl || !this._config.disable_auto_switch_mode)
        {
            //Set the active control mode
            if (entity.attributes.color_mode == LightColorModes.HS || entity.attributes.color_mode == LightColorModes.XY) {
                this._activeControl = controls[controls.findIndex(x => x == "color_control")]
            } else {
                this._activeControl = controls[0];
            }
        }
    }

    private _handleAction(ev: ActionHandlerEvent) {
        handleAction(this, this.hass!, this._config!, ev.detail.action!);
    }

    private _toggleControls(e)
    {
        e.stopPropagation();
        forwardHaptic("medium");

        this._showControls = !this._showControls;
    }

    private _toggleColorSaturation(e)
    {
        e.stopPropagation();
        forwardHaptic("medium");

        this._showSaturation = !this._showSaturation;
    }

    protected renderIcon(entity: LightEntity, icon: string): TemplateResult {
        const lightRgbColor = getRGBColor(entity);
        const active = isActive(entity);
        const iconStyle = {};
        if (lightRgbColor && this._config?.use_light_color) {
            const color = lightRgbColor.join(",");
            iconStyle["--icon-color"] = `rgb(${color})`;
            iconStyle["--shape-color"] = `rgba(${color}, 0.25)`;
            // if (isColorLight(lightRgbColor) && !(this.hass.themes as any).darkMode) {
            //     iconStyle["--shape-outline-color"] = `rgba(var(--rgb-primary-text-color), 0.05)`;
            //     if (isColorSuperLight(lightRgbColor)) {
            //         iconStyle["--icon-color"] = `rgba(var(--rgb-primary-text-color), 0.2)`;
            //     }
            // }
        }
        return html`
            <mushroom-shape-icon
                slot="icon"
                .disabled=${!active}
                .icon=${icon}
                style=${styleMap(iconStyle)}
            ></mushroom-shape-icon>
        `;
    }

    private renderOtherControls(): TemplateResult | null {
        const otherControls = this._controls.filter((control) => control != this._activeControl);

        return html`
            ${otherControls.map(
                (ctrl) => html`
                    <mushroom-button
                        .icon=${CONTROLS_ICONS[ctrl]}
                        @click=${(e) => this._onControlTap(ctrl, e)}
                    />
                `
            )}
        `;
    }

    private renderActiveControl(entity: LightEntity): TemplateResult | null {
        const lightRgbColor = getRGBColor(entity);
        const sliderStyle = {};
        const lightColorStyle = {};

        const supportsBrightness = supportsBrightnessControl(entity);
        const supportsColorTemp = supportsColorTempControl(entity);
        const supportsColor = supportsColorControl(entity);
        const supportsColorSaturation = supportsColorSaturationControl(entity);

        switch (this._activeControl) {
            case "all_controls":
                if (supportsBrightness && lightRgbColor && this._config?.use_light_color) {
                    const color = lightRgbColor.join(",");
                    sliderStyle["--slider-color"] = `rgb(${color})`;
                    sliderStyle["--slider-bg-color"] = `rgba(${color}, 0.2)`;
                    // if (isColorLight(lightRgbColor) && !(this.hass.themes as any).darkMode) {
                    //     sliderStyle["--slider-bg-color"] = `rgba(var(--rgb-primary-text-color), 0.05)`;
                    //     sliderStyle["--slider-color"] = `rgba(var(--rgb-primary-text-color), 0.15)`;
                    // }
                }
                
                if (this._config?.show_all_controls && supportsColorSaturation && entity.attributes.hs_color) {
                    const fixedColor = Color.hsv(entity.attributes.hs_color[0], 100, 100);
                    lightColorStyle["--fixed-color"] = `rgb(${fixedColor.rgb().array()})`;
                    lightColorStyle["--fixed-color-transparent"] = `rgb(${fixedColor.rgb().array()}, 0.1)`;
                }

                return html`
                    ${supportsBrightness ? html`
                        <mushroom-light-brightness-control
                            .hass=${this.hass}
                            .entity=${entity}
                            style=${styleMap(sliderStyle)}
                            @current-change=${this.onCurrentBrightnessChange}
                        />` : null }

                    ${supportsColorTemp ? html`
                        <mushroom-light-color-temp-control 
                            .hass=${this.hass} 
                            .entity=${entity}
                        />
                    ` : null}

                    ${supportsColor ? html`
                        <mushroom-light-color-control 
                            .hass=${this.hass} 
                            .entity=${entity}
                        />
                    `: null}

                    ${supportsColorSaturation ? html`
                        <mushroom-light-color-saturation-control 
                            .hass=${this.hass} 
                            .entity=${entity} 
                            style=${styleMap(lightColorStyle)}
                        />
                    `: null}
                `;
            case "brightness_control":
                if (lightRgbColor && this._config?.use_light_color) {
                    const color = lightRgbColor.join(",");
                    sliderStyle["--slider-color"] = `rgb(${color})`;
                    sliderStyle["--slider-bg-color"] = `rgba(${color}, 0.2)`;
                    // if (isColorLight(lightRgbColor) && !(this.hass.themes as any).darkMode) {
                    //     sliderStyle[ "--slider-bg-color"] = `rgba(var(--rgb-primary-text-color), 0.05)`;
                    //     sliderStyle["--slider-color"] = `rgba(var(--rgb-primary-text-color), 0.15)`;
                    // }
                }
                return html`
                    <mushroom-light-brightness-control
                        .hass=${this.hass}
                        .entity=${entity}
                        style=${styleMap(sliderStyle)}
                        @current-change=${this.onCurrentBrightnessChange}
                    />
                `;
            case "color_temp_control":
                if (this._config?.show_brightness_control && supportsBrightness && lightRgbColor && this._config?.use_light_color) {
                    const color = lightRgbColor.join(",");
                    sliderStyle["--slider-color"] = `rgb(${color})`;
                    sliderStyle["--slider-bg-color"] = `rgba(${color}, 0.2)`;
                    // if (isColorLight(lightRgbColor) && !(this.hass.themes as any).darkMode) {
                    //     sliderStyle[ "--slider-bg-color"] = `rgba(var(--rgb-primary-text-color), 0.05)`;
                    //     sliderStyle["--slider-color"] = `rgba(var(--rgb-primary-text-color), 0.15)`;
                    // }
                }
                
                return html`
                    ${this._config?.show_brightness_control && supportsBrightness ? html`
                        <mushroom-light-brightness-control
                            .hass=${this.hass}
                            .entity=${entity}
                            style=${styleMap(sliderStyle)}
                            @current-change=${this.onCurrentBrightnessChange}
                        />` : null }

                    ${html`
                        <mushroom-light-color-temp-control 
                            .hass=${this.hass} 
                            .entity=${entity} 
                        />
                    `}
                `;
            case "color_control":
                if (this._config?.show_brightness_control && supportsBrightness && lightRgbColor && this._config?.use_light_color) {
                    const color = lightRgbColor.join(",");
                    sliderStyle["--slider-color"] = `rgb(${color})`;
                    sliderStyle["--slider-bg-color"] = `rgba(${color}, 0.2)`;
                    // if (isColorLight(lightRgbColor) && !(this.hass.themes as any).darkMode) {
                    //     sliderStyle["--slider-bg-color"] = `rgba(var(--rgb-primary-text-color), 0.05)`;
                    //     sliderStyle["--slider-color"] = `rgba(var(--rgb-primary-text-color), 0.15)`;
                    // }
                }
                
                if (this._config?.show_color_control && supportsColorSaturation && entity.attributes.hs_color) {
                    const fixedColor = Color.hsv(entity.attributes.hs_color[0], 100, 100);
                    lightColorStyle["--fixed-color"] = `rgb(${fixedColor.rgb().array()})`;
                    lightColorStyle["--fixed-color-transparent"] = `rgb(${fixedColor.rgb().array()}, 0.1)`;
                }
                
                return html`
                    ${this._config?.show_brightness_control && supportsBrightness ? html`
                        <mushroom-light-brightness-control
                            .hass=${this.hass}
                            .entity=${entity}
                            style=${styleMap(sliderStyle)}
                            @current-change=${this.onCurrentBrightnessChange} 
                        />` : null }

                    ${html`
                        <div style="display: flex; justify-content: space-between; gap: 12px;">
                            ${supportsColorSaturation && this._showSaturation
                                ? html`
                                    <mushroom-light-color-saturation-control 
                                        style=${styleMap({
                                            ...lightColorStyle,
                                            "flex-grow": "1",
                                            "margin-right": "0"
                                        })}
                                        .hass=${this.hass} 
                                        .entity=${entity}>
                                    </mushroom-light-color-saturation-control>
                                `
                                : html`
                                    <mushroom-light-color-control 
                                        style=${styleMap({
                                            "flex-grow": "1",
                                            "margin-right": "0"
                                        })}
                                        .hass=${this.hass} 
                                        .entity=${entity}>
                                    </mushroom-light-color-control>
                                `
                            }
                            ${supportsColorSaturation
                                ? html`
                                    <mushroom-button
                                        style=${styleMap({
                                            "flex-shrink": "1",
                                            "height": "calc(var(--control-height)*1.5)",
                                            "width": "calc(var(--control-height) * var(--control-button-ratio) * 1.5)"
                                        })}
                                        .icon=${this._showSaturation ? "mdi:palette" : "mdi:invert-colors"}
                                        @click=${(e) => this._toggleColorSaturation(e)}>
                                    </mushroom-button>
                                `
                                : null
                            }
                        </div>
                    `}
                `;
            default:
                return null;
        }
    }

    protected render(): TemplateResult {
        if (!this._config || !this.hass || !this._config.entity) {
            return html``;
        }

        const entity_id = this._config.entity;
        const entity = this.hass.states[entity_id] as LightEntity;

        const name = this._config.name || entity.attributes.friendly_name || "";
        const icon = this._config.icon || stateIcon(entity);
        const appearance = computeAppearance(this._config);
        const picture = computeEntityPicture(entity, appearance.icon_type);

        let stateDisplay = computeStateDisplay(this.hass.localize, entity, this.hass.locale);
        if (this.brightness != null) {
            stateDisplay = `${this.brightness}%`;
        }

        const rtl = computeRTL(this.hass);

        return html`
            <ha-card class=${classMap({ "fill-container": appearance.fill_container })}>
                <mushroom-card .appearance=${appearance} ?rtl=${rtl}>
                    <div style="display: flex; justify-content: space-between; gap: 12px;">
                        <mushroom-state-item
                            style="flex-grow: 1;"
                            ?rtl=${rtl}
                            .appearance=${appearance}
                            @action=${this._handleAction}
                            .actionHandler=${actionHandler({
                                hasHold: hasAction(this._config.hold_action),
                                hasDoubleClick: hasAction(this._config.double_tap_action),
                            })}
                        >
                            ${picture ? this.renderPicture(picture) : this.renderIcon(entity, icon)}
                            ${this.renderBadge(entity)}
                            ${this.renderStateInfo(entity, appearance, name, stateDisplay)};
                        </mushroom-state-item>
                        ${this._controls.length > 0
                            ? html`
                                <mushroom-button
                                    style="flex-shrink: 1;"
                                    .icon=${this._showControls ? "mdi:brush-off" : "mdi:brush"}
                                    @click=${(e) => this._toggleControls(e)}></mushroom-button>
                            `
                            : null}
                    </div>
                    ${this._controls.length > 0 && this._showControls
                        ? html`
                              <div class="actions" ?rtl=${rtl}>${this.renderActiveControl(entity)}</div>
                              <div class="actionButtons">${this.renderOtherControls()}</div>
                          `
                        : null}
                </mushroom-card>
            </ha-card>
        `;
    }

    static get styles(): CSSResultGroup {
        return [
            super.styles,
            cardStyle,
            css`
                mushroom-state-item {
                    cursor: pointer;
                }
                mushroom-shape-icon {
                    --icon-color: rgb(var(--rgb-state-light));
                    --shape-color: rgba(var(--rgb-state-light), 0.2);
                }
                mushroom-light-brightness-control,
                mushroom-light-color-temp-control,
                mushroom-light-color-control {
                    flex: 1;
                }
            `,
        ];
    }
}
