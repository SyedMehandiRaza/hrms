import { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MdMyLocation,
  MdClose,
  MdOutlineLocationOn,
  MdOutlineSearch,
  MdOutlineCheckCircle,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import Ltr from "./Ltr";
import { reverseGeocodeStatic, searchPlacesStatic } from "../data/groupC";

// Where the map opens when no location has been picked yet (Saudi Arabia).
const DEFAULT_MAP_CENTER = [23.8859, 45.0792];

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ── Fly to position when it changes ── */
function ChangeMapView({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo([position.lat, position.lng], 15);
  }, [position, map]);
  return null;
}

/* ── Click on map to place marker ── */
function LocationMarker({ position, setPosition }) {
  const { t } = useTranslation("offices");
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  if (!position) return null;

  return (
    <Marker
      position={[position.lat, position.lng]}
      draggable
      eventHandlers={{
        dragend(e) {
          const latlng = e.target.getLatLng();
          setPosition({ lat: latlng.lat, lng: latlng.lng });
        },
      }}
    >
      <Popup>{t("locationModal.selectedLocation")}</Popup>
    </Marker>
  );
}

/* ── Current location button (inside map) ── */
function CurrentLocationButton({ setPosition }) {
  const { t } = useTranslation("offices");
  const map = useMap();
  const handleClick = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(newPos);
        map.flyTo([newPos.lat, newPos.lng], 15);
      },
      () => toast.error(t("locationModal.locationError")),
    );
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      title={t("locationModal.useMyLocation")}
      className="absolute top-3 end-3 z-[1000] bg-white shadow-lg p-2.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
    >
      <MdMyLocation className="text-cyan-600 text-xl" />
    </button>
  );
}

/* ══════════════════════════════════════════════════════
   Main Modal
══════════════════════════════════════════════════════ */
export default function LocationPickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialPosition,
  initialAddress,
}) {
  const { t } = useTranslation("offices");
  const [position, setPosition] = useState(initialPosition || null);
  const [address, setAddress] = useState(initialAddress || "");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const searchTimeout = useRef(null);

  // Sync with parent values when modal opens
  useEffect(() => {
    if (isOpen) {
      setPosition(initialPosition || null);
      setAddress(initialAddress || "");
      setSearch("");
      setResults([]);
    }
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Auto current location on first open (if no initial position)
  useEffect(() => {
    if (isOpen && !initialPosition) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
      );
    }
  }, [isOpen]);

  // Reverse geocode when position changes (static build: nearest known place)
  useEffect(() => {
    if (!position) return;
    const id = setTimeout(() => {
      const label = reverseGeocodeStatic(position);
      if (label) setAddress(label);
    }, 0);
    return () => clearTimeout(id);
  }, [position]);

  // Search handler with debounce
  const handleSearch = (value) => {
    setSearch(value);
    clearTimeout(searchTimeout.current);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    searchTimeout.current = setTimeout(() => {
      // Static build: suggestions come from a small list of GCC places.
      setResults(searchPlacesStatic(value));
    }, 400);
  };

  const handleSelectResult = (item) => {
    setPosition({ lat: Number(item.lat), lng: Number(item.lon) });
    setAddress(item.display_name);
    setSearch(item.display_name);
    setResults([]);
  };

  const handleConfirm = () => {
    if (!position) return;
    onConfirm({ position, address });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh" }}
      >
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MdOutlineLocationOn className="text-cyan-600 text-xl" />
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {t("locationModal.title")}
              </h2>
              <p className="text-xs text-gray-400">
                {t("locationModal.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div
          className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar"
        >
          {/* Search bar */}
          <div className="relative">
            <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
            <input
              type="text"
              placeholder={t("locationModal.searchPlaceholder")}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full ps-10 pe-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
            />
            {/* Search results dropdown */}
            {results.length > 0 && (
              <div className="absolute z-[2000] w-full bg-white border border-gray-200 rounded-xl mt-1 max-h-52 overflow-auto shadow-lg">
                {results.map((item) => (
                  <button
                    key={item.place_id}
                    type="button"
                    onClick={() => handleSelectResult(item)}
                    className="w-full text-left px-4 py-2.5 hover:bg-cyan-50 border-b border-gray-50 text-sm text-gray-700 transition-colors last:border-b-0"
                  >
                    <span className="flex items-start gap-2">
                      <MdOutlineLocationOn className="text-cyan-500 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{item.display_name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="relative rounded-xl overflow-hidden border border-gray-200">
            <MapContainer
              center={
                // No pin yet → open on Saudi Arabia (it used to open on India).
                position ? [position.lat, position.lng] : DEFAULT_MAP_CENTER
              }
              zoom={position ? 14 : 5}
              style={{ height: "340px", width: "100%" }}
              className="z-0"
            >
              <TileLayer
                attribution="© OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ChangeMapView position={position} />
              <LocationMarker position={position} setPosition={setPosition} />
              <CurrentLocationButton setPosition={setPosition} />
            </MapContainer>

            {/* Click hint overlay — shown when no position yet */}
            {!position && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[500] bg-black/60 text-white text-xs font-medium px-4 py-2 rounded-full pointer-events-none">
                {t("locationModal.clickHint")}
              </div>
            )}
          </div>

          {/* Selected info cards */}
          {position && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Address */}
              {address && (
                <div className="bg-cyan-50 border border-cyan-100 rounded-xl px-4 py-3 sm:col-span-2">
                  <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider mb-1">
                    {t("locationModal.selectedAddress")}
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {address}
                  </p>
                </div>
              )}

              {/* Lat */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("locationModal.latitude")}
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  <Ltr>{position.lat.toFixed(6)}</Ltr>
                </p>
              </div>

              {/* Lng */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("locationModal.longitude")}
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  <Ltr>{position.lng.toFixed(6)}</Ltr>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Fixed Footer ── */}
        <div className="border-t border-gray-100 px-5 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {t("locationModal.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!position}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <MdOutlineCheckCircle className="text-lg" />
            {t("locationModal.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
