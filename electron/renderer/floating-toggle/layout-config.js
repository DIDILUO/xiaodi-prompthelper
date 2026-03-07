/*
 * Floating toggle layout constants and derived geometry.
 * Keep this file as the single source of truth for renderer + main process.
 */
'use strict';

const FLOAT_WIN_DRAG_STRIP_HEIGHT = 20;
const FLOAT_WIN_TOGGLE_HEIGHT = 40;
const FLOAT_WIN_QUICK_BUTTON_SIZE = 40;
const FLOAT_WIN_QUICK_BUTTON_GAP = 8;
const FLOAT_WIN_QUICK_GROUP_TOP_GAP = 10;
const FLOAT_WIN_QUICK_BUTTON_COUNT = 1;
const FLOAT_WIN_QUICK_MAIN_BUTTON_COUNT = 1;
const FLOAT_WIN_DIVIDER_HEIGHT = 1;
const FLOAT_WIN_DIVIDER_MARGIN_Y = 8;
const FLOAT_WIN_QUICK_PADDING_Y = 8;
const FLOAT_WIN_OUTER_GAP = 6;
const FLOAT_WIN_MARGIN = 6;
const FLOAT_WIN_RESIZE_ANIMATION_MS = 140;
const FLOAT_WIN_OPACITY_MIN = 0.35;
const FLOAT_WIN_OPACITY_MAX = 1;
const FLOAT_WIN_OPACITY_DEFAULT = 1;

function getQuickDevButtonCount() {
  return Math.max(0, FLOAT_WIN_QUICK_BUTTON_COUNT - FLOAT_WIN_QUICK_MAIN_BUTTON_COUNT);
}

function getQuickGapCount() {
  const mainGapCount = Math.max(0, FLOAT_WIN_QUICK_MAIN_BUTTON_COUNT - 1);
  const quickDevButtonCount = getQuickDevButtonCount();
  const devGapCount = Math.max(0, quickDevButtonCount - 1);
  return mainGapCount + devGapCount;
}

function getQuickDividerBlockHeight() {
  return FLOAT_WIN_QUICK_MAIN_BUTTON_COUNT > 0 && getQuickDevButtonCount() > 0
    ? FLOAT_WIN_DIVIDER_HEIGHT + (FLOAT_WIN_DIVIDER_MARGIN_Y * 2)
    : 0;
}

const FLOAT_WIN_COLLAPSED_HEIGHT = FLOAT_WIN_DRAG_STRIP_HEIGHT
  + FLOAT_WIN_TOGGLE_HEIGHT
  + (FLOAT_WIN_OUTER_GAP * 2);

const FLOAT_WIN_QUICK_GROUP_HEIGHT = FLOAT_WIN_QUICK_BUTTON_COUNT > 0
  ? FLOAT_WIN_QUICK_GROUP_TOP_GAP
    + (FLOAT_WIN_QUICK_BUTTON_SIZE * FLOAT_WIN_QUICK_BUTTON_COUNT)
    + (FLOAT_WIN_QUICK_BUTTON_GAP * getQuickGapCount())
    + getQuickDividerBlockHeight()
    + FLOAT_WIN_QUICK_PADDING_Y
    + 2
  : 0;

const FLOAT_WIN_EXPANDED_HEIGHT = FLOAT_WIN_COLLAPSED_HEIGHT
  + FLOAT_WIN_QUICK_GROUP_HEIGHT;

function getFloatingToggleCollapsedWidth() {
  return FLOAT_WIN_TOGGLE_HEIGHT + (FLOAT_WIN_OUTER_GAP * 2);
}

function getFloatingToggleExpandedWidth() {
  return Math.max(
    getFloatingToggleCollapsedWidth(),
    FLOAT_WIN_QUICK_BUTTON_SIZE + (FLOAT_WIN_OUTER_GAP * 2)
  );
}

module.exports = {
  FLOAT_WIN_DRAG_STRIP_HEIGHT,
  FLOAT_WIN_TOGGLE_HEIGHT,
  FLOAT_WIN_QUICK_BUTTON_SIZE,
  FLOAT_WIN_QUICK_BUTTON_GAP,
  FLOAT_WIN_QUICK_GROUP_TOP_GAP,
  FLOAT_WIN_QUICK_BUTTON_COUNT,
  FLOAT_WIN_QUICK_MAIN_BUTTON_COUNT,
  FLOAT_WIN_DIVIDER_HEIGHT,
  FLOAT_WIN_DIVIDER_MARGIN_Y,
  FLOAT_WIN_QUICK_PADDING_Y,
  FLOAT_WIN_OUTER_GAP,
  FLOAT_WIN_RESIZE_ANIMATION_MS,
  FLOAT_WIN_COLLAPSED_HEIGHT,
  FLOAT_WIN_EXPANDED_HEIGHT,
  FLOAT_WIN_MARGIN,
  FLOAT_WIN_OPACITY_MIN,
  FLOAT_WIN_OPACITY_MAX,
  FLOAT_WIN_OPACITY_DEFAULT,
  getFloatingToggleCollapsedWidth,
  getFloatingToggleExpandedWidth
};
