import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { approximateMapCenter, approximateMapLocation, geocodeAddress, isValidMapLocation } from "../lib/propertyLocation";
import "leaflet/dist/leaflet.css";
import "./PropertyMap.css";

const PHILIPPINES_CENTER = [12.8797, 121.774];

export default function PropertyMap({ location, onLocationChange, label = "Approximate property location", addressHint = "" }) {
  const editable = typeof onLocationChange === "function";
  const hasLocation = isValidMapLocation(location);
  const center = approximateMapCenter(location) || PHILIPPINES_CENTER;
  const [searchValue, setSearchValue] = useState(String(addressHint ?? "").trim());
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  async function handleAddressSearch(event, customQuery = searchValue) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (!editable) return;

    const trimmed = String(customQuery ?? searchValue ?? "").trim();
    if (!trimmed) {
      setSearchError("Enter an address or area to search for.");
      return;
    }

    setSearchValue(trimmed);
    setSearching(true);
    setSearchError("");

    try {
      const result = await geocodeAddress(trimmed);
      if (!result) {
        setSearchError("No matching location was found. Try a more specific address or barangay.");
        return;
      }

      onLocationChange(approximateMapLocation(result.latitude, result.longitude));
      setSearchValue(result.label || trimmed);
    } catch (error) {
      setSearchError(error.message || "Address lookup failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="property-map" role="group" aria-label={label}>
      {editable && (
        <div className="property-map__search">
          <input
            type="text"
            className="property-map__search-input"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddressSearch(event);
              }
            }}
            placeholder="Search address, barangay, or city"
            aria-label="Search an address to find the map pin"
          />
          <button type="button" className="btn btn--secondary property-map__search-button" disabled={searching} onClick={(event) => handleAddressSearch(event)}>
            {searching ? "Searching..." : "Find pin"}
          </button>
          {addressHint && (
            <button
              type="button"
              className="btn btn--secondary property-map__search-button"
              disabled={searching}
              onClick={(event) => handleAddressSearch(event, addressHint)}
            >
              Use my exact address
            </button>
          )}
        </div>
      )}
      {editable && searchError && <p className="property-map__error" role="alert">{searchError}</p>}
      <MapContainer
        center={center}
        zoom={hasLocation ? 12 : 5}
        scrollWheelZoom={false}
        className="property-map__canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasLocation && (
          <CircleMarker
            center={center}
            radius={9}
            pathOptions={{ color: "#1d4ed8", fillColor: "#60a5fa", fillOpacity: 0.9, weight: 2 }}
          />
        )}
        <MapCenter location={location} />
        {editable && <MapClickHandler onLocationChange={onLocationChange} />}
      </MapContainer>
      <p className="property-map__caption">
        {hasLocation
          ? "Approximate area shown. The exact address is kept private."
          : editable
            ? "Search an address to place the pin or click the map to choose an approximate area."
            : "No approximate map location has been added."}
      </p>
    </div>
  );
}

function MapCenter({ location }) {
  const map = useMap();

  useEffect(() => {
    if (isValidMapLocation(location)) map.setView(approximateMapCenter(location), 12);
  }, [location, map]);

  return null;
}

function MapClickHandler({ onLocationChange }) {
  useMapEvents({
    click(event) {
      onLocationChange(approximateMapLocation(event.latlng.lat, event.latlng.lng));
    },
  });

  return null;
}
