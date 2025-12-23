/*
 * Forked from SmugMug justified-layout (MIT license).
 */

class Row {
  constructor(params) {
    this.top = params.top;
    this.left = params.left;
    this.width = params.width;
    this.spacing = params.spacing;

    this.targetRowHeight = params.targetRowHeight;
    this.targetRowHeightTolerance = params.targetRowHeightTolerance;
    this.minAspectRatio =
      (this.width / params.targetRowHeight) * (1 - params.targetRowHeightTolerance);
    this.maxAspectRatio =
      (this.width / params.targetRowHeight) * (1 + params.targetRowHeightTolerance);

    this.edgeCaseMinRowHeight = params.edgeCaseMinRowHeight;
    this.edgeCaseMaxRowHeight = params.edgeCaseMaxRowHeight;

    this.widowLayoutStyle = params.widowLayoutStyle;
    this.isBreakoutRow = params.isBreakoutRow;

    this.items = [];
    this.height = 0;
  }

  addItem(itemData) {
    const newItems = this.items.concat(itemData);
    const rowWidthWithoutSpacing = this.width - (newItems.length - 1) * this.spacing;
    const newAspectRatio = newItems.reduce((sum, item) => sum + item.aspectRatio, 0);
    const targetAspectRatio = rowWidthWithoutSpacing / this.targetRowHeight;
    let previousRowWidthWithoutSpacing;
    let previousAspectRatio;
    let previousTargetAspectRatio;

    if (this.isBreakoutRow) {
      if (this.items.length === 0 && itemData.aspectRatio >= 1) {
        this.items.push(itemData);
        this.completeLayout(rowWidthWithoutSpacing / itemData.aspectRatio, "justify");
        return true;
      }
    }

    if (newAspectRatio < this.minAspectRatio) {
      this.items.push({ ...itemData });
      return true;
    }

    if (newAspectRatio > this.maxAspectRatio) {
      if (this.items.length === 0) {
        this.items.push({ ...itemData });
        this.completeLayout(rowWidthWithoutSpacing / newAspectRatio, "justify");
        return true;
      }

      previousRowWidthWithoutSpacing =
        this.width - (this.items.length - 1) * this.spacing;
      previousAspectRatio = this.items.reduce((sum, item) => sum + item.aspectRatio, 0);
      previousTargetAspectRatio = previousRowWidthWithoutSpacing / this.targetRowHeight;

      if (Math.abs(newAspectRatio - targetAspectRatio) >
        Math.abs(previousAspectRatio - previousTargetAspectRatio)) {
        this.completeLayout(previousRowWidthWithoutSpacing / previousAspectRatio, "justify");
        return false;
      }

      this.items.push({ ...itemData });
      this.completeLayout(rowWidthWithoutSpacing / newAspectRatio, "justify");
      return true;
    }

    this.items.push({ ...itemData });
    this.completeLayout(rowWidthWithoutSpacing / newAspectRatio, "justify");
    return true;
  }

  isLayoutComplete() {
    return this.height > 0;
  }

  completeLayout(newHeight, widowLayoutStyle) {
    let itemWidthSum = this.left;
    const rowWidthWithoutSpacing = this.width - (this.items.length - 1) * this.spacing;
    let clampedToNativeRatio;
    let clampedHeight;
    let errorWidthPerItem;
    let roundedCumulativeErrors;
    let singleItemGeometry;
    let centerOffset;

    if (typeof widowLayoutStyle === "undefined" ||
      ["justify", "center", "left"].indexOf(widowLayoutStyle) < 0) {
      widowLayoutStyle = "left";
    }

    clampedHeight = Math.max(this.edgeCaseMinRowHeight, Math.min(newHeight, this.edgeCaseMaxRowHeight));

    if (newHeight !== clampedHeight) {
      this.height = clampedHeight;
      clampedToNativeRatio = (rowWidthWithoutSpacing / clampedHeight) /
        (rowWidthWithoutSpacing / newHeight);
    } else {
      this.height = newHeight;
      clampedToNativeRatio = 1.0;
    }

    this.items.forEach((item) => {
      item.top = this.top;
      item.width = item.aspectRatio * this.height * clampedToNativeRatio;
      item.height = this.height;
      item.left = itemWidthSum;
      itemWidthSum += item.width + this.spacing;
    });

    if (widowLayoutStyle === "justify") {
      itemWidthSum -= this.spacing + this.left;
      errorWidthPerItem = (itemWidthSum - this.width) / this.items.length;
      roundedCumulativeErrors = this.items.map((_item, i) => Math.round((i + 1) * errorWidthPerItem));

      if (this.items.length === 1) {
        singleItemGeometry = this.items[0];
        singleItemGeometry.width -= Math.round(errorWidthPerItem);
      } else {
        this.items.forEach((item, i) => {
          if (i > 0) {
            item.left -= roundedCumulativeErrors[i - 1];
            item.width -= roundedCumulativeErrors[i] - roundedCumulativeErrors[i - 1];
          } else {
            item.width -= roundedCumulativeErrors[i];
          }
        });
      }
    } else if (widowLayoutStyle === "center") {
      centerOffset = (this.width - itemWidthSum) / 2;
      this.items.forEach((item) => {
        item.left += centerOffset + this.spacing;
      });
    }
  }

  forceComplete(_fitToWidth, rowHeight) {
    if (typeof rowHeight === "number") {
      this.completeLayout(rowHeight, this.widowLayoutStyle);
    } else {
      this.completeLayout(this.targetRowHeight, this.widowLayoutStyle);
    }
  }

  getItems() {
    return this.items;
  }
}

function createNewRow(layoutConfig, layoutData) {
  let isBreakoutRow;

  if (layoutConfig.fullWidthBreakoutRowCadence !== false) {
    if (((layoutData._rows.length + 1) % layoutConfig.fullWidthBreakoutRowCadence) === 0) {
      isBreakoutRow = true;
    }
  }

  return new Row({
    top: layoutData._containerHeight,
    left: layoutConfig.containerPadding.left,
    width: layoutConfig.containerWidth -
      layoutConfig.containerPadding.left -
      layoutConfig.containerPadding.right,
    spacing: layoutConfig.boxSpacing.horizontal,
    targetRowHeight: layoutConfig.targetRowHeight,
    targetRowHeightTolerance: layoutConfig.targetRowHeightTolerance,
    edgeCaseMinRowHeight: 0.5 * layoutConfig.targetRowHeight,
    edgeCaseMaxRowHeight: 2 * layoutConfig.targetRowHeight,
    rightToLeft: false,
    isBreakoutRow: isBreakoutRow,
    widowLayoutStyle: layoutConfig.widowLayoutStyle,
  });
}

function addRow(layoutConfig, layoutData, row) {
  layoutData._rows.push(row);
  layoutData._layoutItems = layoutData._layoutItems.concat(row.getItems());
  layoutData._containerHeight += row.height + layoutConfig.boxSpacing.vertical;
  return row.items;
}

function computeLayout(layoutConfig, layoutData, itemLayoutData) {
  let laidOutItems = [];
  let itemAdded;
  let currentRow;
  let nextToLastRowHeight;

  if (layoutConfig.forceAspectRatio) {
    itemLayoutData.forEach((itemData) => {
      itemData.forcedAspectRatio = true;
      itemData.aspectRatio = layoutConfig.forceAspectRatio;
    });
  }

  itemLayoutData.some((itemData, i) => {
    if (Number.isNaN(itemData.aspectRatio)) {
      throw new Error(`Item ${i} has an invalid aspect ratio`);
    }

    if (!currentRow) {
      currentRow = createNewRow(layoutConfig, layoutData);
    }

    itemAdded = currentRow.addItem(itemData);

    if (currentRow.isLayoutComplete()) {
      laidOutItems = laidOutItems.concat(addRow(layoutConfig, layoutData, currentRow));

      if (layoutData._rows.length >= layoutConfig.maxNumRows) {
        currentRow = null;
        return true;
      }

      currentRow = createNewRow(layoutConfig, layoutData);

      if (!itemAdded) {
        itemAdded = currentRow.addItem(itemData);
        if (currentRow.isLayoutComplete()) {
          laidOutItems = laidOutItems.concat(addRow(layoutConfig, layoutData, currentRow));
          if (layoutData._rows.length >= layoutConfig.maxNumRows) {
            currentRow = null;
            return true;
          }
          currentRow = createNewRow(layoutConfig, layoutData);
        }
      }
    }
  });

  if (currentRow && currentRow.getItems().length && layoutConfig.showWidows) {
    if (layoutData._rows.length) {
      if (layoutData._rows[layoutData._rows.length - 1].isBreakoutRow) {
        nextToLastRowHeight = layoutData._rows[layoutData._rows.length - 1].targetRowHeight;
      } else {
        nextToLastRowHeight = layoutData._rows[layoutData._rows.length - 1].height;
      }
      currentRow.forceComplete(false, nextToLastRowHeight);
    } else {
      currentRow.forceComplete(false);
    }

    laidOutItems = laidOutItems.concat(addRow(layoutConfig, layoutData, currentRow));
    layoutConfig._widowCount = currentRow.getItems().length;
  }

  layoutData._containerHeight = layoutData._containerHeight - layoutConfig.boxSpacing.vertical;
  layoutData._containerHeight = layoutData._containerHeight + layoutConfig.containerPadding.bottom;

  return {
    containerHeight: layoutData._containerHeight,
    widowCount: layoutConfig._widowCount,
    boxes: layoutData._layoutItems,
  };
}

export default function justifiedLayout(input, config) {
  let layoutConfig = {};
  const layoutData = {};

  const defaults = {
    containerWidth: 1060,
    containerPadding: 10,
    boxSpacing: 10,
    targetRowHeight: 320,
    targetRowHeightTolerance: 0.25,
    maxNumRows: Number.POSITIVE_INFINITY,
    forceAspectRatio: false,
    showWidows: true,
    fullWidthBreakoutRowCadence: false,
    widowLayoutStyle: "left",
  };

  const containerPadding = {};
  const boxSpacing = {};

  config = config || {};
  layoutConfig = Object.assign(defaults, config);

  containerPadding.top =
    !Number.isNaN(parseFloat(layoutConfig.containerPadding.top)) ?
      layoutConfig.containerPadding.top :
      layoutConfig.containerPadding;
  containerPadding.right =
    !Number.isNaN(parseFloat(layoutConfig.containerPadding.right)) ?
      layoutConfig.containerPadding.right :
      layoutConfig.containerPadding;
  containerPadding.bottom =
    !Number.isNaN(parseFloat(layoutConfig.containerPadding.bottom)) ?
      layoutConfig.containerPadding.bottom :
      layoutConfig.containerPadding;
  containerPadding.left =
    !Number.isNaN(parseFloat(layoutConfig.containerPadding.left)) ?
      layoutConfig.containerPadding.left :
      layoutConfig.containerPadding;
  boxSpacing.horizontal =
    !Number.isNaN(parseFloat(layoutConfig.boxSpacing.horizontal)) ?
      layoutConfig.boxSpacing.horizontal :
      layoutConfig.boxSpacing;
  boxSpacing.vertical =
    !Number.isNaN(parseFloat(layoutConfig.boxSpacing.vertical)) ?
      layoutConfig.boxSpacing.vertical :
      layoutConfig.boxSpacing;

  layoutConfig.containerPadding = containerPadding;
  layoutConfig.boxSpacing = boxSpacing;

  layoutData._layoutItems = [];
  layoutData._awakeItems = [];
  layoutData._inViewportItems = [];
  layoutData._leadingOrphans = [];
  layoutData._trailingOrphans = [];
  layoutData._containerHeight = layoutConfig.containerPadding.top;
  layoutData._rows = [];
  layoutData._orphans = [];
  layoutConfig._widowCount = 0;

  return computeLayout(
    layoutConfig,
    layoutData,
    input.map((item) => {
      if (item.width && item.height) {
        return { aspectRatio: item.width / item.height };
      }
      return { aspectRatio: item };
    })
  );
}
