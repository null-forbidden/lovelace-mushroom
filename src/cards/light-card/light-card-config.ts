import { assign, boolean, number, object, optional } from "superstruct";
import { LovelaceCardConfig } from "../../ha";
import { ActionsSharedConfig, actionsSharedConfigStruct } from "../../shared/config/actions-config";
import {
    AppearanceSharedConfig,
    appearanceSharedConfigStruct,
} from "../../shared/config/appearance-config";
import { EntitySharedConfig, entitySharedConfigStruct } from "../../shared/config/entity-config";
import { lovelaceCardConfigStruct } from "../../shared/config/lovelace-card-config";

export type LightCardConfig = LovelaceCardConfig &
    EntitySharedConfig &
    AppearanceSharedConfig &
    ActionsSharedConfig & {
        show_all_controls?: boolean;
        show_brightness_control?: boolean;
        show_color_temp_control?: boolean;
        show_color_control?: boolean;
        collapsible_controls?: boolean;
        use_light_color?: boolean;
        default_kelvin?: number;
        default_rgb?: number[];
        disable_auto_switch_mode?: boolean;
    };

export const lightCardConfigStruct = assign(
    lovelaceCardConfigStruct,
    assign(entitySharedConfigStruct, appearanceSharedConfigStruct, actionsSharedConfigStruct),
    object({
        show_all_controls: optional(boolean()),
        show_brightness_control: optional(boolean()),
        show_color_temp_control: optional(boolean()),
        show_color_control: optional(boolean()),
        collapsible_controls: optional(boolean()),
        use_light_color: optional(boolean()),
        default_kelvin: optional(number()),
        default_rgb: optional(object()),
        disable_auto_switch_mode: optional(boolean()),
    })
);
