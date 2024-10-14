import type { ActionDetail } from "@material/mwc-list";
import { mdiCheck, mdiDotsVertical } from "@mdi/js";
import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators";
import { styleMap } from "lit/directives/style-map";
import memoizeOne from "memoize-one";
import { fireEvent } from "../../../../common/dom/fire_event";
import { preventDefault } from "../../../../common/dom/prevent_default";
import { stopPropagation } from "../../../../common/dom/stop_propagation";
import "../../../../components/ha-button";
import "../../../../components/ha-button-menu";
import "../../../../components/ha-grid-size-picker";
import "../../../../components/ha-icon-button";
import "../../../../components/ha-list-item";
import "../../../../components/ha-settings-row";
import "../../../../components/ha-slider";
import "../../../../components/ha-svg-icon";
import "../../../../components/ha-switch";
import "../../../../components/ha-yaml-editor";
import { LovelaceCardConfig } from "../../../../data/lovelace/config/card";
import { LovelaceSectionConfig } from "../../../../data/lovelace/config/section";
import { haStyle } from "../../../../resources/styles";
import { HomeAssistant } from "../../../../types";
import { HuiCard } from "../../cards/hui-card";
import {
  CardGridSize,
  computeCardGridSize,
  migrateLayoutToGridOptions,
} from "../../common/compute-card-grid-size";
import { LovelaceGridOptions } from "../../types";

@customElement("hui-card-layout-editor")
export class HuiCardLayoutEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public config!: LovelaceCardConfig;

  @property({ attribute: false }) public sectionConfig!: LovelaceSectionConfig;

  @state() _defaultGridOptions?: LovelaceGridOptions;

  @state() public _yamlMode = false;

  @state() public _uiAvailable = true;

  private _cardElement?: HuiCard;

  private _mergedOptions = memoizeOne(
    (options?: LovelaceGridOptions, defaultOptions?: LovelaceGridOptions) => ({
      ...defaultOptions,
      ...options,
    })
  );

  private _computeCardGridSize = memoizeOne(computeCardGridSize);

  private _isDefault = memoizeOne(
    (options?: LovelaceGridOptions) =>
      options?.columns === undefined && options?.rows === undefined
  );

  private _configGridOptions = (config: LovelaceCardConfig) => {
    if (config.grid_options) {
      return config.grid_options;
    }
    if (config.layout_options) {
      return migrateLayoutToGridOptions(config.layout_options);
    }
    return {};
  };

  render() {
    const configGridOptions = this._configGridOptions(this.config);
    const options = this._mergedOptions(
      configGridOptions,
      this._defaultGridOptions
    );

    const value = this._computeCardGridSize(options);

    const totalColumns = (this.sectionConfig.column_span ?? 1) * 12;

    return html`
      <div class="header">
        <p class="intro">
          ${this.hass.localize(
            "ui.panel.lovelace.editor.edit_card.layout.explanation"
          )}
        </p>
        <ha-button-menu
          slot="icons"
          @action=${this._handleAction}
          @click=${preventDefault}
          @closed=${stopPropagation}
          fixed
          .corner=${"BOTTOM_END"}
          .menuCorner=${"END"}
        >
          <ha-icon-button
            slot="trigger"
            .label=${this.hass.localize("ui.common.menu")}
            .path=${mdiDotsVertical}
          >
          </ha-icon-button>

          <ha-list-item graphic="icon" .disabled=${!this._uiAvailable}>
            ${this.hass.localize("ui.panel.lovelace.editor.edit_card.edit_ui")}
            ${!this._yamlMode
              ? html`
                  <ha-svg-icon
                    class="selected_menu_item"
                    slot="graphic"
                    .path=${mdiCheck}
                  ></ha-svg-icon>
                `
              : nothing}
          </ha-list-item>

          <ha-list-item graphic="icon">
            ${this.hass.localize(
              "ui.panel.lovelace.editor.edit_card.edit_yaml"
            )}
            ${this._yamlMode
              ? html`
                  <ha-svg-icon
                    class="selected_menu_item"
                    slot="graphic"
                    .path=${mdiCheck}
                  ></ha-svg-icon>
                `
              : nothing}
          </ha-list-item>
        </ha-button-menu>
      </div>
      ${this._yamlMode
        ? html`
            <ha-yaml-editor
              .hass=${this.hass}
              .defaultValue=${configGridOptions}
              @value-changed=${this._valueChanged}
            ></ha-yaml-editor>
          `
        : html`
            <ha-grid-size-picker
              style=${styleMap({
                "max-width": `${totalColumns * 20 + 50}px`,
              })}
              .columns=${totalColumns}
              .hass=${this.hass}
              .value=${value}
              .isDefault=${this._isDefault(configGridOptions)}
              @value-changed=${this._gridSizeChanged}
              .rowMin=${options.min_rows}
              .rowMax=${options.max_rows}
              .columnMin=${options.min_columns}
              .columnMax=${options.max_columns}
            ></ha-grid-size-picker>
            <ha-settings-row>
              <span slot="heading" data-for="full-width">
                ${this.hass.localize(
                  "ui.panel.lovelace.editor.edit_card.layout.full_width"
                )}
              </span>
              <span slot="description" data-for="full-width">
                ${this.hass.localize(
                  "ui.panel.lovelace.editor.edit_card.layout.full_width_helper"
                )}
              </span>
              <ha-switch
                @change=${this._fullWidthChanged}
                .checked=${value.columns === "full"}
                name="full-width"
              >
              </ha-switch>
            </ha-settings-row>
            <ha-settings-row>
              <span slot="heading" data-for="full-width">
                ${this.hass.localize(
                  "ui.panel.lovelace.editor.edit_card.layout.precision_mode"
                )}
              </span>
              <span slot="description" data-for="full-width">
                ${this.hass.localize(
                  "ui.panel.lovelace.editor.edit_card.layout.precision_mode_helper"
                )}
              </span>
              <ha-switch name="full-precision_mode"> </ha-switch>
            </ha-settings-row>
          `}
    `;
  }

  protected firstUpdated(changedProps: PropertyValues<this>): void {
    super.firstUpdated(changedProps);
    try {
      this._cardElement = document.createElement("hui-card");
      this._cardElement.hass = this.hass;
      this._cardElement.preview = true;
      this._cardElement.config = this.config;
      this._cardElement.addEventListener("card-updated", (ev: Event) => {
        ev.stopPropagation();
        this._defaultGridOptions = this._cardElement?.getElementGridOptions();
      });
      this._cardElement.load();
      this._defaultGridOptions = this._cardElement.getElementGridOptions();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  protected updated(changedProps: PropertyValues<this>): void {
    super.updated(changedProps);
    if (this._cardElement) {
      if (changedProps.has("hass")) {
        this._cardElement.hass = this.hass;
      }
      if (changedProps.has("config")) {
        this._cardElement.config = this.config;
      }
    }
  }

  private async _handleAction(ev: CustomEvent<ActionDetail>) {
    switch (ev.detail.index) {
      case 0:
        this._yamlMode = false;
        break;
      case 1:
        this._yamlMode = true;
        break;
    }
  }

  private _gridSizeChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const value = ev.detail.value as CardGridSize;

    const newConfig: LovelaceCardConfig = {
      ...this.config,
      grid_options: {
        ...this.config.grid_options,
        columns: value.columns,
        rows: value.rows,
      },
    };

    this._updateValue(newConfig);
  }

  private _updateValue(value: LovelaceCardConfig): void {
    if (value.grid_options!.columns === undefined) {
      delete value.grid_options!.columns;
    }
    if (value.grid_options!.rows === undefined) {
      delete value.grid_options!.rows;
    }
    if (Object.keys(value.grid_options!).length === 0) {
      delete value.grid_options;
    }
    if (value.layout_options) {
      delete value.layout_options;
    }
    fireEvent(this, "value-changed", { value });
  }

  private _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const options = ev.detail.value as LovelaceGridOptions;
    const newConfig: LovelaceCardConfig = {
      ...this.config,
      grid_options: options,
    };
    this._updateValue(newConfig);
  }

  private _fullWidthChanged(ev): void {
    ev.stopPropagation();
    const value = ev.target.checked;
    const newConfig: LovelaceCardConfig = {
      ...this.config,
      grid_options: {
        ...this.config.grid_options,
        columns: value ? "full" : (this._defaultGridOptions?.min_columns ?? 1),
      },
    };
    this._updateValue(newConfig);
  }

  static styles = [
    haStyle,
    css`
      .header {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
      }
      .header .intro {
        flex: 1;
        margin: 0;
        color: var(--secondary-text-color);
      }
      .header ha-button-menu {
        --mdc-theme-text-primary-on-background: var(--primary-text-color);
        margin-top: -8px;
      }
      .selected_menu_item {
        color: var(--primary-color);
      }
      .disabled {
        opacity: 0.5;
        pointer-events: none;
      }
      ha-grid-size-picker {
        display: block;
        margin: 16px auto;
        direction: ltr;
      }
      ha-yaml-editor {
        display: block;
        margin: 16px 0;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-card-layout-editor": HuiCardLayoutEditor;
  }
}
