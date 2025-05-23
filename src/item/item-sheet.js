export class ForbiddenLandsItemSheet extends foundry.appv1.sheets.ItemSheet {
	get itemData() {
		return this.item.data;
	}

	get itemProperties() {
		return this.item.system;
	}

	get config() {
		return CONFIG.fbl;
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			...super.defaultOptions,
			classes: ["forbidden-lands", "sheet", "item"],
			width: window.innerWidth * 0.08 + 350,
			resizable: false,
		});
	}

	static async enrichContent(content, isOwner) {
		return foundry.applications.ux.TextEditor.implementation.enrichHTML(content, {
			async: true,
			secrets: isOwner,
		});
	}

	_getHeaderButtons() {
		let buttons = super._getHeaderButtons();
		buttons = [
			{
				label: game.i18n.localize("SHEET.HEADER.POST_ITEM"),
				class: "item-post",
				icon: "fas fa-comment",
				onclick: () => {
					this.item.sendToChat();
				},
			},
		].concat(buttons);
		return buttons;
	}

	#computeQuality(data) {
		data.artifact = !!data.system.artifactBonus;
		data.lethal = data.system.lethal === "yes";
		data.ranks =
			data.system.type === "general" || data.system.type === "profession";
		return data;
	}

	async #enrichTextEditorFields(data) {
		const fields = CONFIG.fbl.enrichedItemFields;

		for (const field of fields) {
			const [key, subKey] = field.split(".");
			if (subKey && data.system[key]?.[subKey]) {
				data.system[key][subKey] = await ForbiddenLandsItemSheet.enrichContent(
					data.system[key][subKey],
					game.user.isGM,
				);
			} else if (data.system[key]) {
				data.system[field] = await ForbiddenLandsItemSheet.enrichContent(
					data.system[field],
					game.user.isGM,
				);
			}
		}
		return data;
	}

	async getData() {
		const superData = super.getData();
		let data = superData.data;
		data.flags = this.item.flags["forbidden-lands"];
		data.encumbranceValues = this.config.encumbrance;
		data.isGM = game.user.isGM;
		data = this.#computeQuality(data);
		data = await this.#enrichTextEditorFields(data);

		data.artifactBonusOptions = [
			{ value: "", label: "ARTIFACT.REGULAR" },
			{ value: "0", label: "ARTIFACT.DICELESS" },
			{ value: "d8", label: "ARTIFACT.MIGHTY" },
			{ value: "d10", label: "ARTIFACT.EPIC" },
			{ value: "d12", label: "ARTIFACT.LEGENDARY" }
		];

		return data;
	}

	_onChangeTab(event, tabs, active) {
		$(`#${this.id} textarea`).each(function () {
			if (this.value) {
				this.readOnly = true;
				this.setAttribute(
					"style",
					`height:${this.scrollHeight}px;overflow-y:hidden;`,
				);
			}
		});
		return super._onChangeTab(event, tabs, active);
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find(".add-modifier").click(async (ev) => {
			ev.preventDefault();
			const data = await this.getData();
			const rollModifiers = data.system.rollModifiers || {};
			// To preserve order, make sure the new index is the highest
			const modifierId =
				Math.max(-1, ...Object.getOwnPropertyNames(rollModifiers)) + 1;
			const update = {};
			// Using a default value of Strength and 1 in order NOT to create an empty modifier.
			update[`system.rollModifiers.${modifierId}`] = {
				name: "ATTRIBUTE.STRENGTH",
				value: "+1",
			};
			await this.item.update(update);
		});
		html.find(".delete-modifier").click(async (ev) => {
			ev.preventDefault();
			const data = await this.getData();
			const rollModifiers = duplicate(data.system.rollModifiers || {});
			const modifierId = $(ev.currentTarget).data("modifier-id");
			delete rollModifiers[modifierId];
			// Safety cleanup of null modifiers
			for (const key in Object.keys(rollModifiers)) {
				if (!rollModifiers[key]) {
					delete rollModifiers[key];
				}
			}
			// There seems to be some issue replacing an existing object, if we set
			// it to null first it works better.
			await this.item.update({ "system.rollModifiers": null });
			if (Object.keys(rollModifiers).length > 0) {
				await this.item.update({ "system.rollModifiers": rollModifiers });
			}
		});
		html.find(".change-bonus").on("click contextmenu", (ev) => {
			const bonus = this.itemProperties.bonus;
			let value = bonus.value;
			const altInteraction = game.settings.get(
				"forbidden-lands",
				"alternativeSkulls",
			);
			if (
				(ev.type === "click" && !altInteraction) ||
				(ev.type === "contextmenu" && altInteraction)
			) {
				value = Math.max(value - 1, 0);
			} else if (
				(ev.type === "contextmenu" && !altInteraction) ||
				(ev.type === "click" && altInteraction)
			) {
				value = Math.min(value + 1, bonus.max);
			}
			this.object.update({
				["system.bonus.value"]: value,
			});
		});
		html.find(".feature").click(async (ev) => {
			const featureName = $(ev.currentTarget).data("feature");
			const features = this.object.itemProperties.features;
			if (CONFIG.fbl.weaponFeatures.includes(featureName))
				this.object.update({
					[`system.features.${featureName}`]: !features[featureName],
				});
			this._render();
		});
		html.find(".hide-field").click((ev) => {
			const fieldName = $(ev.currentTarget).data("fieldname");
			const currentValue = this.object.getFlag("forbidden-lands", fieldName);
			this.object.setFlag("forbidden-lands", fieldName, !currentValue);
		});
	}

	async getCustomRollModifiers() {
		const pack = game.packs.get("world.customrollmodifiers");
		if (pack) {
			const customRollModifier = await pack.getContent();
			return customRollModifier.map((item) => item.name);
		}
		return [];
	}

	async _renderInner(data, options) {
		const showField = (field) => {
			const enabledInSettings = game.settings.get(
				"forbidden-lands",
				`show${field}Field`,
			);
			const isVisibleToPlayer =
				game.user.isGM || !this.object.getFlag("forbidden-lands", field);
			return enabledInSettings && isVisibleToPlayer;
		};
		data = {
			...data,
			alternativeSkulls: game.settings.get(
				"forbidden-lands",
				"alternativeSkulls",
			),
			showCraftingFields: game.settings.get(
				"forbidden-lands",
				"showCraftingFields",
			),
			showCostField: game.settings.get("forbidden-lands", "showCostField"),
			showSupplyField: game.settings.get("forbidden-lands", "showSupplyField"),
			showEffectField: showField("Effect"),
			showDescriptionField: showField("Description"),
			showDrawbackField: showField("Drawback"),
			showAppearanceField: showField("Appearance"),
		};
		data.system.customRollModifiers = await this.getCustomRollModifiers();
		return super._renderInner(data, options);
	}
}
