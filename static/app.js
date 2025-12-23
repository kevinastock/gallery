import justifiedLayout from "./justified/justified-layout.esm.js";
import PhotoSwipeLightbox from "./photoswipe/photoswipe-lightbox.esm.js";

const gallery = document.querySelector(".gallery");
const items = Array.from(gallery.querySelectorAll(".gallery-item"));
const hasDownloads = items.some((item) => item.dataset.download);
const scrollSpacer = document.querySelector(".scroll-spacer");
const sizes = items.map((item) => ({
  width: Number(item.dataset.width),
  height: Number(item.dataset.height),
}));

const defaultMargin = 4;
const margin = Number(gallery.dataset.margin);
const boxSpacing = Number.isFinite(margin) ? Math.max(0, margin) : defaultMargin;

const layoutConfig = {
  containerPadding: 0,
  boxSpacing: { horizontal: boxSpacing, vertical: boxSpacing },
  targetRowHeight: 320,
  targetRowHeightTolerance: 0.25,
  showWidows: true,
};

function getContainerWidth() {
  return (
    gallery.clientWidth ||
    gallery.parentElement?.clientWidth ||
    document.documentElement.clientWidth
  );
}

function applyLayout() {
  const width = getContainerWidth();
  if (!width) {
    return;
  }

  const geometry = justifiedLayout(sizes, {
    ...layoutConfig,
    containerWidth: width,
  });

  let lastRowTop = null;
  let lastRowHeight = 0;
  items.forEach((item, index) => {
    const box = geometry.boxes[index];
    item.style.left = `${box.left}px`;
    item.style.top = `${box.top}px`;
    item.style.width = `${box.width}px`;
    item.style.height = `${box.height}px`;

    const isRowStart = lastRowTop === null || Math.abs(box.top - lastRowTop) > 1;
    if (isRowStart) {
      item.classList.add("snap");
      lastRowTop = box.top;
      lastRowHeight = box.height;
    } else {
      item.classList.remove("snap");
      if (lastRowTop === box.top) {
        lastRowHeight = Math.max(lastRowHeight, box.height);
      }
    }
  });

  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const extraScroll = Math.max(0, viewportHeight - lastRowHeight);
  gallery.style.height = `${geometry.containerHeight}px`;
  if (scrollSpacer) {
    scrollSpacer.style.height = `${extraScroll}px`;
  }
}

function initLightbox() {
  const lightbox = new PhotoSwipeLightbox({
    gallery: ".gallery",
    children: "a",
    pswpModule: () => import("./photoswipe/photoswipe.esm.js"),
  });
  if (hasDownloads) {
    lightbox.on("itemData", (event) => {
      const download = event.itemData.element?.dataset?.download;
      if (download) {
        event.itemData.download = download;
      }
    });
    lightbox.on("uiRegister", () => {
      lightbox.pswp.ui.registerElement({
        name: 'download-button',
        order: 8,
        isButton: true,
        tagName: 'a',

        // SVG with outline
        html: {
          isCustomSVG: true,
          inner: '<path d="M20.5 14.3 17.1 18V10h-2.2v7.9l-3.4-3.6L10 16l6 6.1 6-6.1ZM23 23H9v2h14Z" id="pswp__icn-download"/>',
          outlineID: 'pswp__icn-download'
        },

        onInit: (el, pswp) => {
          el.setAttribute('download', '');
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener');

          pswp.on('change', () => {
            el.href = pswp.currSlide.data.download || pswp.currSlide.data.src;
          });
        }
      });
    });
  }
  lightbox.init();
}

let resizeTimer;
function scheduleLayout() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    applyLayout();
  }, 150);
}

let initialLayoutRaf = null;
function applyLayoutWhenReady() {
  if (getContainerWidth()) {
    applyLayout();
    return;
  }
  initialLayoutRaf = window.requestAnimationFrame(applyLayoutWhenReady);
}

const resizeObserver = new ResizeObserver(() => scheduleLayout());
resizeObserver.observe(gallery);

window.addEventListener("resize", scheduleLayout);

applyLayoutWhenReady();
initLightbox();
