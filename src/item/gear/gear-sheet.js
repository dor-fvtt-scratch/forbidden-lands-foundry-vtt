import { ForbiddenLandsItemSheet } from "@item/item-sheet";

export class ForbiddenLandsGearSheet extends ForbiddenLandsItemSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			...super.defaultOptions,
			template: "systems/forbidden-lands/templates/item/gear/gear-sheet.hbs",
			tabs: [
				{
					navSelector: ".sheet-tabs",
					contentSelector: ".sheet-body",
					initial: "main",
				},
			],
		});
	}

	async getData(options) {
		const data = await super.getData(options);
		data.encumbranceValues = CONFIG.fbl.encumbrance;
		return data;
	}
}
