import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowLeft, Upload } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { countWords, SHOWING_DAYS, validateListingForm } from "../lib/listingValidation";
import { uploadSecureDocument } from "../secureDocument";
import { uploadToCloudinary } from "../uploadImage";
import "./UserPages.css";

const PROPERTY_TYPES = ["Room", "Studio", "Apartment", "House", "Condo"];
const AMENITIES = ["Parking", "WiFi", "Furnished", "Pets allowed", "Air conditioning", "Security"];

export default function EditListing() {
  const { listingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState({ ownership: null, governmentId: null });
  const [newPhotos, setNewPhotos] = useState([]);
  const [ownershipDocument, setOwnershipDocument] = useState(null);
  const [governmentId, setGovernmentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getDoc(doc(db, "listings", listingId)).then((snapshot) => {
      if (!snapshot.exists()) setError("This listing could not be found.");
      else if (snapshot.data().ownerId !== user.uid) setError("You can only edit your own listings.");
      else {
        const data = snapshot.data();
        setForm({
          title: data.title || "", description: data.description || "", type: data.type || "Apartment",
          address: data.address || "", city: data.city || "", price: data.price || "", pricePeriod: data.pricePeriod || "month",
          bedrooms: data.bedrooms ?? "", bathrooms: data.bathrooms ?? "", floorArea: data.floorArea || "", lotArea: data.lotArea || "",
          availabilityDate: data.availabilityDate || "", amenities: data.amenities || [], showingWindows: normalizeShowingWindows(data.showingWindows),
        });
        setExistingPhotos(data.photoUrls || []);
        setExistingDocuments({ ownership: data.ownershipDocumentPath || data.ownershipDocumentUrl || data.verificationDocUrl || null, governmentId: data.governmentIdPath || data.governmentIdUrl || null });
      }
      setLoading(false);
    }).catch(() => { setError("This listing could not be loaded."); setLoading(false); });
  }, [listingId, user.uid]);

  function updateField(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  function toggleAmenity(amenity) { setForm((current) => ({ ...current, amenities: current.amenities.includes(amenity) ? current.amenities.filter((item) => item !== amenity) : [...current.amenities, amenity] })); }
  function updateShowingWindow(day, field, value) { setForm((current) => ({ ...current, showingWindows: { ...current.showingWindows, [day]: { ...current.showingWindows[day], [field]: value } } })); }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validateListingForm({ form, photos: [...existingPhotos, ...newPhotos], ownershipDocument: ownershipDocument || existingDocuments.ownership, governmentId: governmentId || existingDocuments.governmentId });
    if (validationErrors.length) { setError(validationErrors.join(" ")); return; }
    setSaving(true);
    setError("");
    try {
      const [ownershipDocumentUrl, governmentIdUrl, uploadedPhotoUrls] = await Promise.all([
        ownershipDocument ? uploadSecureDocument(ownershipDocument, user.uid, listingId, "ownership") : existingDocuments.ownership,
        governmentId ? uploadSecureDocument(governmentId, user.uid, listingId, "government-id") : existingDocuments.governmentId,
        Promise.all(newPhotos.map((photo) => uploadToCloudinary(photo))),
      ]);
      await updateDoc(doc(db, "listings", listingId), {
        title: form.title.trim(), description: form.description.trim(), type: form.type, address: form.address.trim(), city: form.city.trim(),
        price: Number(form.price), pricePeriod: form.pricePeriod, bedrooms: Number(form.bedrooms), bathrooms: Number(form.bathrooms),
        floorArea: form.floorArea ? Number(form.floorArea) : null, lotArea: form.lotArea ? Number(form.lotArea) : null,
        availabilityDate: form.availabilityDate, amenities: form.amenities, showingWindows: form.showingWindows,
        photoUrls: [...existingPhotos, ...uploadedPhotoUrls], ownershipDocumentPath: ownershipDocumentUrl, governmentIdPath: governmentIdUrl, verificationStatus: "pending", resubmissionRequested: false, updatedAt: serverTimestamp(),
      });
      navigate(`/listings/${listingId}`, { replace: true });
    } catch (saveError) { setError(saveError.message || "Your changes could not be saved. Please try again."); } finally { setSaving(false); }
  }

  return <div className="user-page"><PublicNav /><main className="user-page__content user-page__content--form"><Link to={`/listings/${listingId}`} className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> Listing details</Link><header className="user-page__header"><div><p className="user-page__eyebrow">Owner tools</p><h1>Edit listing</h1><p>Saving changes sends this listing back for review.</p></div></header>{loading ? <p className="user-page__empty">Loading listing...</p> : error && !form ? <div className="user-page__empty" role="alert"><h2>Unable to edit listing</h2><p>{error}</p></div> : <form className="listing-form" onSubmit={handleSubmit}><section className="user-page__empty listing-form__section"><h2>Property details</h2><div className="listing-form__grid"><Field id="edit-title" name="title" label="Listing title" value={form.title} onChange={updateField} wide /><div className="field listing-form__wide"><label className="field__label" htmlFor="edit-description">Description</label><textarea id="edit-description" name="description" className="listing-form__textarea" rows={8} value={form.description} onChange={updateField} required /><small className="listing-form__hint">{countWords(form.description)} words (150-400 required)</small></div><SelectField id="edit-type" name="type" label="Property type" value={form.type} onChange={updateField} options={PROPERTY_TYPES} /><Field id="edit-address" name="address" label="Address or area" value={form.address} onChange={updateField} /><Field id="edit-city" name="city" label="City" value={form.city} onChange={updateField} /><Field id="edit-price" name="price" label="Price" type="number" value={form.price} onChange={updateField} /><SelectField id="edit-period" name="pricePeriod" label="Price period" value={form.pricePeriod} onChange={updateField} options={["month", "day"]} /><Field id="edit-bedrooms" name="bedrooms" label="Bedrooms" type="number" value={form.bedrooms} onChange={updateField} /><Field id="edit-bathrooms" name="bathrooms" label="Bathrooms" type="number" step="0.5" value={form.bathrooms} onChange={updateField} /><Field id="edit-availability" name="availabilityDate" label="Available from" type="date" value={form.availabilityDate} onChange={updateField} /><div className="field listing-form__wide"><span className="field__label">Amenities</span><div className="listing-form__amenities">{AMENITIES.map((amenity) => <label className="listing-form__amenity" key={amenity}><input type="checkbox" checked={form.amenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} />{amenity}</label>)}</div></div><div className="field listing-form__wide"><span className="field__label">Showing windows</span><div className="listing-form__showing-windows">{SHOWING_DAYS.map((day) => <div className="listing-form__showing-row" key={day}><label className="listing-form__amenity"><input type="checkbox" checked={form.showingWindows[day].enabled} onChange={(event) => updateShowingWindow(day, "enabled", event.target.checked)} />{day}</label><input className="field__input" type="time" value={form.showingWindows[day].start} disabled={!form.showingWindows[day].enabled} onChange={(event) => updateShowingWindow(day, "start", event.target.value)} aria-label={`${day} showing start`} /><span>to</span><input className="field__input" type="time" value={form.showingWindows[day].end} disabled={!form.showingWindows[day].enabled} onChange={(event) => updateShowingWindow(day, "end", event.target.value)} aria-label={`${day} showing end`} /></div>)}</div></div><Field id="edit-floor" name="floorArea" label="Floor area (sqm)" type="number" value={form.floorArea} onChange={updateField} /><Field id="edit-lot" name="lotArea" label="Lot area (sqm)" type="number" value={form.lotArea} onChange={updateField} /></div></section><section className="user-page__empty listing-form__section"><h2>Photos and verification</h2><p className="listing-form__hint">Keep at least 4 property photos. Existing documents remain valid unless replaced.</p><div className="listing-form__uploads"><label className="listing-form__upload"><Upload size={18} aria-hidden="true" /><span>Additional property photos</span><small>{newPhotos.length ? `${newPhotos.length} selected` : `${existingPhotos.length} already saved`}</small><input type="file" accept="image/*" multiple onChange={(event) => setNewPhotos(Array.from(event.target.files || []).slice(0, 8))} /></label><label className="listing-form__upload"><Upload size={18} aria-hidden="true" /><span>Ownership document</span><small>{ownershipDocument?.name || (existingDocuments.ownership ? "Existing document saved" : "Required")}</small><input type="file" accept="image/*,.pdf" onChange={(event) => setOwnershipDocument(event.target.files?.[0] || null)} /></label><label className="listing-form__upload"><Upload size={18} aria-hidden="true" /><span>Government photo ID</span><small>{governmentId?.name || (existingDocuments.governmentId ? "Existing ID saved" : "Required")}</small><input type="file" accept="image/*" onChange={(event) => setGovernmentId(event.target.files?.[0] || null)} /></label></div></section>{error && <p className="user-page__form-error" role="alert">{error}</p>}<button type="submit" className="btn btn--primary listing-form__submit" disabled={saving}>{saving ? "Saving..." : "Save and submit for review"}</button></form>}</main></div>;
}

function Field({ id, name, label, value, onChange, type = "text", step, wide = false }) { return <div className={`field${wide ? " listing-form__wide" : ""}`}><label className="field__label" htmlFor={id}>{label}</label><input id={id} name={name} className="field__input" type={type} min={type === "number" ? "0" : undefined} step={step} value={value} onChange={onChange} required /></div>; }
function SelectField({ id, name, label, value, onChange, options }) { return <div className="field"><label className="field__label" htmlFor={id}>{label}</label><select id={id} name={name} className="field__input" value={value} onChange={onChange} required>{options.map((option) => <option key={option}>{option}</option>)}</select></div>; }
function normalizeShowingWindows(windows = {}) { return Object.fromEntries(SHOWING_DAYS.map((day) => [day, { enabled: Boolean(windows[day]?.enabled), start: windows[day]?.start || "09:00", end: windows[day]?.end || "17:00" }])); }
