const header = document.querySelector("[data-header]");
const lightbox = document.querySelector("[data-lightbox]");
const lightboxImage = document.querySelector("[data-lightbox-image]");
const closeButton = document.querySelector(".lightbox-close");

const updateHeader = () => {
  header?.classList.toggle("is-solid", window.scrollY > 80);
};

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

document.querySelectorAll("[data-gallery]").forEach((item) => {
  item.addEventListener("click", () => {
    const image = item.getAttribute("data-gallery");
    if (!image || !lightbox || !lightboxImage) return;

    lightboxImage.setAttribute("src", image);
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
  });
});

const closeLightbox = () => {
  if (!lightbox || !lightboxImage) return;

  lightbox.hidden = true;
  lightboxImage.setAttribute("src", "");
  document.body.style.overflow = "";
};

closeButton?.addEventListener("click", closeLightbox);
lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLightbox();
});
