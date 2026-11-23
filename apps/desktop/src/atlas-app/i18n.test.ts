import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SETTINGS,
  filterSettingsCategories,
  getDisplayLibraryName,
  getMessages,
  getQuickLookSpeedMultiplier,
  normalizeSettings,
} from "./i18n.ts";

test("English and Simplified Chinese dictionaries share exact key parity", () => {
  const en = getMessages("en");
  const zh = getMessages("zh-CN");

  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(enKeys, zhKeys);

  for (const key of enKeys) {
    const enVal = en[key as keyof typeof en];
    const zhVal = zh[key as keyof typeof zh];
    assert.equal(typeof enVal, typeof zhVal, `Type mismatch on key "${key}"`);
    if (typeof zhVal === "string") {
      assert.ok(zhVal.trim().length > 0, `Empty zh-CN string for "${key}"`);
    }
  }
});

test("normalizeSettings clamps veil opacity and validates enum values safely", () => {
  const normalized = normalizeSettings({
    locale: "zh-CN",
    veilOpacity: 0.2,
    quickLookSpeed: "silky",
    canvasTidyDensity: "spacious",
    exportFormat: "png",
  });

  assert.equal(normalized.locale, "zh-CN");
  assert.equal(normalized.veilOpacity, 0.72);
  assert.equal(normalized.quickLookSpeed, "silky");
  assert.equal(getQuickLookSpeedMultiplier(normalized.quickLookSpeed), 1.3);
  assert.equal(normalized.canvasTidyDensity, "spacious");
  assert.equal(normalized.exportFormat, "png");
  assert.equal(getDisplayLibraryName(normalized), "Atlas 资料库");

  const withCustomName = normalizeSettings({
    ...DEFAULT_SETTINGS,
    locale: "zh-CN",
    libraryName: "灵感素材库",
  });
  assert.equal(getDisplayLibraryName(withCustomName), "灵感素材库");
});

test("filterSettingsCategories matches bilingual queries in both English and Chinese", () => {
  const zhLangMatches = filterSettingsCategories("语言", "zh-CN");
  assert.ok(zhLangMatches.includes("general"));

  const zhMotionMatches = filterSettingsCategories("避让", "zh-CN");
  assert.ok(zhMotionMatches.includes("motion"));

  const enStorageMatches = filterSettingsCategories("export", "en");
  assert.ok(enStorageMatches.includes("storage"));

  const allMatches = filterSettingsCategories("", "zh-CN");
  assert.equal(allMatches.length, 7);
});
