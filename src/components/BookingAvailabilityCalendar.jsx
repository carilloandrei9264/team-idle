import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dateInputValue, toDate } from "../lib/booking";

export default function BookingAvailabilityCalendar({
  blockedRanges = [],
  availabilityDate,
  startDate,
  endDate,
  onSelectDate,
  onInvalidRange,
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selectedDate = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
    return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  });
  const monthDates = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const monthLabel = visibleMonth.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  const today = dateInputValue();
  const firstAllowedDate = availabilityDate && availabilityDate > today ? availabilityDate : today;

  const unavailableDays = useMemo(() => {
    const blocked = new Set();
    blockedRanges.forEach((range) => {
      const start = toDate(range.start);
      const end = toDate(range.end);
      if (!start || !end || start >= end) return;
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (cursor < lastDay) {
        blocked.add(formatDayKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return blocked;
  }, [blockedRanges]);

  function selectDate(key) {
    if (!startDate || endDate || key < startDate) {
      onSelectDate(key, "");
      return;
    }

    const crossesUnavailableDay = Array.from(unavailableDays)
      .some((day) => day >= startDate && day < key);
    if (crossesUnavailableDay) {
      onInvalidRange?.();
      return;
    }
    onSelectDate(startDate, key);
  }

  return (
    <section className="booking-select-calendar" aria-label="Listing availability calendar">
      <div className="booking-select-calendar__header">
        <button
          type="button"
          className="booking-select-calendar__month-button"
          aria-label="Previous month"
          disabled={monthIsBefore(visibleMonth, new Date())}
          onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <h3>{monthLabel}</h3>
        <button
          type="button"
          className="booking-select-calendar__month-button"
          aria-label="Next month"
          onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="booking-select-calendar__weekdays" aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="booking-select-calendar__days">
        {monthDates.map((date) => {
          const key = formatDayKey(date);
          const isOutsideMonth = date.getMonth() !== visibleMonth.getMonth();
          const isUnavailable = unavailableDays.has(key);
          const isTooEarly = key < firstAllowedDate;
          const isStart = key === startDate;
          const isEnd = key === endDate;
          const isCheckoutBoundary = isUnavailable && Boolean(startDate && !endDate && key > startDate);
          const isSelectedRange = Boolean(startDate && endDate && startDate < key && key < endDate);
          const disabled = isOutsideMonth || isTooEarly || (isUnavailable && !isCheckoutBoundary);
          const stateLabel = isCheckoutBoundary ? "Available for checkout only"
            : isUnavailable ? "Unavailable"
            : isStart ? "Check-in date"
            : isEnd ? "Check-out date"
            : isSelectedRange ? "Selected stay"
            : disabled ? "Not available for selection"
            : "Available";

          return (
            <button
              key={key}
              type="button"
              className={[
                "booking-select-calendar__day",
                isOutsideMonth ? "booking-select-calendar__day--outside" : "",
                isUnavailable ? "booking-select-calendar__day--unavailable" : "",
                isCheckoutBoundary ? "booking-select-calendar__day--checkout-boundary" : "",
                isStart || isEnd || isSelectedRange ? "booking-select-calendar__day--selected" : "",
              ].join(" ")}
              disabled={disabled}
              aria-label={`${date.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}: ${stateLabel}`}
              aria-pressed={isStart || isEnd}
              title={stateLabel}
              onClick={() => selectDate(key)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div className="booking-select-calendar__legend" aria-label="Calendar key">
        <span><i className="booking-select-calendar__swatch" />Available</span>
        <span><i className="booking-select-calendar__swatch booking-select-calendar__swatch--selected" />Selected dates</span>
        <span><i className="booking-select-calendar__swatch booking-select-calendar__swatch--unavailable" />Unavailable</span>
      </div>
    </section>
  );
}

function buildMonthGrid(dateValue) {
  const monthStart = new Date(dateValue.getFullYear(), dateValue.getMonth(), 1);
  const gridStart = new Date(monthStart);
  const offset = (monthStart.getDay() + 6) % 7;
  gridStart.setDate(monthStart.getDate() - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    return current;
  });
}

function formatDayKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthIsBefore(month, date) {
  return new Date(month.getFullYear(), month.getMonth(), 1) < new Date(date.getFullYear(), date.getMonth(), 1);
}
