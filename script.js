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

const calendar = document.querySelector("[data-calendar]");
const calendarMonth = document.querySelector("[data-calendar-month]");
const calendarStatus = document.querySelector("[data-calendar-status]");
const calendarPrev = document.querySelector("[data-calendar-prev]");
const calendarNext = document.querySelector("[data-calendar-next]");

const monthNames = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

const weekdayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
let visibleMonth = new Date();
visibleMonth.setDate(1);

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addCalendarDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const buildBusySet = (ranges) => {
  const busy = new Set();

  ranges.forEach((range) => {
    let day = new Date(`${range.start}T00:00:00`);
    const end = new Date(`${range.end}T00:00:00`);

    while (day < end) {
      busy.add(formatDateKey(day));
      day = addCalendarDays(day, 1);
    }
  });

  return busy;
};

const loadAvailability = async (month) => {
  const from = formatDateKey(new Date(month.getFullYear(), month.getMonth(), 1));
  const to = formatDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 1));

  const response = await fetch(`/api/availability?from=${from}&to=${to}`, {
    headers: { accept: "application/json" }
  });

  if (!response.ok) throw new Error("availability unavailable");
  return response.json();
};

const renderCalendar = async () => {
  if (!calendar || !calendarMonth || !calendarStatus) return;

  calendarMonth.textContent = `${monthNames[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`;
  calendar.innerHTML = weekdayNames.map((day) => `<span>${day}</span>`).join("");
  calendarStatus.textContent = "Проверяем занятость";

  let busyDays = new Set();
  let hasLiveData = false;

  try {
    const availability = await loadAvailability(visibleMonth);
    busyDays = buildBusySet(availability.busy || []);
    hasLiveData = true;
    calendarStatus.textContent = availability.feedErrors?.length
      ? "Часть площадок не ответила"
      : "Синхронизировано с площадками";
  } catch {
    calendarStatus.textContent = "Живой календарь включим на VPS";
  }

  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = addCalendarDays(first, -startOffset);

  for (let index = 0; index < 42; index += 1) {
    const day = addCalendarDays(gridStart, index);
    const key = formatDateKey(day);
    const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
    const isBusy = busyDays.has(key);
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = String(day.getDate());
    button.classList.toggle("is-outside", !isCurrentMonth);
    button.classList.toggle("is-busy", isBusy);
    button.classList.toggle("is-free", hasLiveData && isCurrentMonth && !isBusy);
    button.title = isBusy ? "Занято" : hasLiveData ? "Предварительно свободно" : "Дату нужно уточнить";
    calendar.append(button);
  }
};

calendarPrev?.addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  renderCalendar();
});

calendarNext?.addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  renderCalendar();
});

renderCalendar();
