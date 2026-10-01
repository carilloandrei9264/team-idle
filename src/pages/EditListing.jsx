import { useEffect, useState } from "react";
import { deleteField, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { ArrowLeft, Upload } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import PropertyMap from "../components/PropertyMap";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { countWords, SHOWING_DAYS, validateListingForm } from "../lib/listingValidation";
import { documentResourceType, uploadPrivateDocument, uploadToCloudinary } from "../uploadImage";
import { signPrivateDocumentUpload } from "../services/api";
import "./UserPages.css";

const PROPERTY_TYPES = ["Room", "Studio", "Apartment", "House", "Condo", "Land"];
const AMENITIES = ["Parking", "WiFi", "Furnished", "Pets allowed", "Air conditioning", "Security"];

export default function EditListing() {
  const { listingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState({
    ownership: null,
    governmentId: null,
    legacyOwnership: false,
    legacyGovernmentId: false,
  });
  const [newPhotos, setNewPhotos] = useState([]);
  const [ownershipDocument, setOwnershipDocument] = useState(null);
  const [governmentId, setGovernmentId] = useState(null);
  const [mapLocation, setMapLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getDoc(doc(db, "listings", listingId)),
      getDoc(doc(db, "listingPrivate", listingId)),
    ]).then(([snapshot, privateSnapshot]) => {
      if (!snapshot.exists()) setError("This listing could not be found.");
      else if (snapshot.data().ownerId !== user.uid) setError("You can only edit your own listings.");
      else {
        const data = snapshot.data();
        const privateData = privateSnapshot.exists() ? privateSnapshot.data() : {};
        const listingPurpose = data.listingPurpose || "rent";
        const rentalTerm = data.rentalTerm || (data.pricePeriod === "day" ? "short_term" : "long_term");
        setForm({
          title: data.title || "", description: data.description || "", type: data.type || "Apartment",
          address: privateData.address || data.address || "", city: data.city || "", price: data.price || "",
          listingPurpose, rentalTerm, pricePeriod: listingPurpose === "sale" ? "total" : rentalTerm === "short_term" ? "day" : "month",
          bedrooms: data.bedrooms ?? "", bathrooms: data.bathrooms ?? "", floorArea: data.floorArea || "", lotArea: data.lotArea || "",
          availabilityDate: data.availabilityDate || "", amenities: data.amenities || [], showingWindows: normalizeShowingWindows(data.showingWindows),
        });
        setMapLocation(data.mapLocation || null);
        setExistingPhotos(data.photoUrls || []);
        setExistingDocuments({
          ownership: privateData.documents?.ownership || null,
          governmentId: privateData.documents?.govId || null,
          legacyOwnership: Boolean(privateData.ownershipDocumentUrl || data.ownershipDocumentPath || data.ownershipDocumentUrl || data.verificationDocUrl),
          legacyGovernmentId: Boolean(privateData.governmentIdUrl || data.governmentIdPath || data.governmentIdUrl),
        });
      }
      setLoading(false);
    }).catch(() => { setError("This listing could not be loaded."); setLoading(false); });
  }, [listingId, user.uid]);

  function updateField(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  function updateListingPurpose(listingPurpose) { setForm((current) => { const rentalTerm = current.rentalTerm || "long_term"; return { ...current, listingPurpose, rentalTerm, pricePeriod: listingPurpose === "sale" ? "total" : rentalTerm === "short_term" ? "day" : "month" }; }); }
  function updateRentalTerm(rentalTerm) { setForm((current) => ({ ...current, rentalTerm, pricePeriod: rentalTerm === "short_term" ? "day" : "month" })); }
  function toggleAmenity(amenity) { setForm((current) => ({ ...current, amenities: current.amenities.includes(amenity) ? current.amenities.filter((item) => item !== amenity) : [...current.amenities, amenity] })); }
  function updateShowingWindow(day, field, value) { setForm((current) => ({ ...current, showingWindows: { ...current.showingWindows, [day]: { ...current.showingWindows[day], [field]: value } } })); }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validateListingForm({ form, photos: [...existingPhotos, ...newPhotos], ownershipDocument: ownershipDocument || existingDocuments.ownership, governmentId: governmentId || existingDocuments.governmentId, mapLocation });
    if (validationErrors.length) { setError(validationErrors.join(" ")); return; }
    setSaving(true);
    setError("");
    try {
      const ownershipResourceType = ownershipDocument && documentResourceType(ownershipDocument) === "raw" ? "raw" : "image";
      const [ownershipSignature, governmentIdSignature, uploadedPhotoUrls] = await Promise.all([
        ownershipDocument ? signPrivateDocumentUpload(listingId, "ownership", ownershipResourceType) : null,
        governmentId ? signPrivateDocumentUpload(listingId, "govId", documentResourceType(governmentId) === "raw" ? "raw" : "image") : null,
        Promise.all(newPhotos.map((photo) => uploadToCloudinary(photo, "auto", listingAssetOptions(listingId, "photos", "property-photo")))),
      ]);
      const [uploadedOwnershipDocument, uploadedGovernmentId] = await Promise.all([
        ownershipDocument ? uploadPrivateDocument(ownershipDocument, ownershipSignature, ownershipResourceType) : null,
        governmentId ? uploadPrivateDocument(governmentId, governmentIdSignature, documentResourceType(governmentId) === "raw" ? "raw" : "image") : null,
      ]);
      const ownershipDocumentAsset = uploadedOwnershipDocument || (isDocumentAsset(existingDocuments.ownership) ? existingDocuments.ownership : null);
      const governmentIdAsset = uploadedGovernmentId || (isDocumentAsset(existingDocuments.governmentId) ? existingDocuments.governmentId : null);
      const batch = writeBatch(db);
      batch.update(doc(db, "listings", listingId), {
        title: form.title.trim(), description: form.description.trim(), type: form.type, listingPurpose: form.listingPurpose,
        rentalTerm: form.listingPurpose === "rent" ? form.rentalTerm : null, address: deleteField(),
        ownershipDocumentUrl: deleteField(), governmentIdUrl: deleteField(), verificationDocUrl: deleteField(), city: form.city.trim(),
        mapLocation,
        price: Number(form.price), pricePeriod: form.pricePeriod, bedrooms: Number(form.bedrooms), bathrooms: Number(form.bathrooms),
        floorArea: form.floorArea ? Number(form.floorArea) : null, lotArea: form.lotArea ? Number(form.lotArea) : null,
        availabilityDate: form.availabilityDate, amenities: form.amenities, showingWindows: form.showingWindows,
        photoUrls: [...existingPhotos, ...uploadedPhotoUrls], verificationStatus: "pending", resubmissionRequested: false, updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, "listingPrivate", listingId), {
        ownerId: user.uid,
        address: form.address.trim(),
        ownershipDocumentUrl: deleteField(),
        governmentIdUrl: deleteField(),
        ...(ownershipDocumentAsset || governmentIdAsset ? {
          documents: {
            ...(ownershipDocumentAsset ? { ownership: ownershipDocumentAsset } : {}),
            ...(governmentIdAsset ? { govId: governmentIdAsset } : {}),
          },
        } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await batch.commit();
      navigate(`/listings/${listingId}`, { replace: true });
    } catch (saveError) { setError(saveError.message || "Your changes could not be saved. Please try again."); } finally { setSaving(false); }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content user-page__content--form">
        <Link to={`/listings/${listingId}`} className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> Listing details</Link>
        <header className="user-page__header">
          <div><p className="user-page__eyebrow">Owner tools</p><h1>Edit listing</h1><p>Saving changes sends this listing back for review.</p></div>
        </header>
        {loading ? <p className="user-page__empty">Loading listing...</p> : error && !form ? (
          <div className="user-page__empty" role="alert"><h2>Unable to edit listing</h2><p>{error}</p></div>
        ) : (
          <form className="listing-form" onSubmit={handleSubmit}>
            <section className="user-page__empty listing-form__section">
              <h2>Property details</h2>
              <div className="listing-form__grid">
                <Field id="edit-title" name="title" label="Listing title" value={form.title} onChange={updateField} wide />
                <div className="field listing-form__wide">
                  <label className="field__label" htmlFor="edit-description">Description</label>
                  <textarea id="edit-description" name="description" className="listing-form__textarea" rows={8} value={form.description} onChange={updateField} required />
                  <small className="listing-form__hint">{countWords(form.description)} words · recommended 150-400 words</small>
                </div>
                <div className="field listing-form__wide">
                  <span className="field__label">Listing purpose</span>
                  <div className="listing-form__purpose-options" role="radiogroup" aria-label="Listing purpose">
                    <label className={`listing-form__purpose-option${form.listingPurpose === "rent" ? " listing-form__purpose-option--selected" : ""}`}>
                      <input type="radio" name="editListingPurpose" value="rent" checked={form.listingPurpose === "rent"} onChange={() => updateListingPurpose("rent")} />
                      <span><strong>For rent</strong><small>Short stays or long-term homes</small></span>
                    </label>
                    <label className={`listing-form__purpose-option${form.listingPurpose === "sale" ? " listing-form__purpose-option--selected" : ""}`}>
                      <input type="radio" name="editListingPurpose" value="sale" checked={form.listingPurpose === "sale"} onChange={() => updateListingPurpose("sale")} />
                      <span><strong>For sale</strong><small>One-time asking price</small></span>
                    </label>
                  </div>
                </div>
                {form.listingPurpose === "rent" && (
                  <div className="field">
                    <label className="field__label" htmlFor="edit-rentalTerm">Rental term</label>
                    <select id="edit-rentalTerm" className="field__input" value={form.rentalTerm} onChange={(event) => updateRentalTerm(event.target.value)}>
                      <option value="short_term">Short-term stay · per night</option>
                      <option value="long_term">Long-term home · per month</option>
                    </select>
                  </div>
                )}
                <SelectField id="edit-type" name="type" label="Property type" value={form.type} onChange={updateField} options={PROPERTY_TYPES} />
                <Field id="edit-address" name="address" label="Private address or area" value={form.address} onChange={updateField} />
                <Field id="edit-city" name="city" label="City" value={form.city} onChange={updateField} />
                <div className="field listing-form__wide">
                  <span className="field__label">Approximate map location (optional)</span>
                  <PropertyMap location={mapLocation} onLocationChange={setMapLocation} addressHint={form.address} />
                  {mapLocation && <button type="button" className="btn btn--secondary" onClick={() => setMapLocation(null)}>Remove map pin</button>}
                </div>
                <Field id="edit-price" name="price" label={form.listingPurpose === "sale" ? "Asking price" : form.rentalTerm === "short_term" ? "Price per night" : "Price per month"} type="number" value={form.price} onChange={updateField} />
                <Field id="edit-bedrooms" name="bedrooms" label="Bedrooms" type="number" value={form.bedrooms} onChange={updateField} />
                <Field id="edit-bathrooms" name="bathrooms" label="Bathrooms" type="number" step="0.5" value={form.bathrooms} onChange={updateField} />
                <Field id="edit-availability" name="availabilityDate" label="Available from" type="date" value={form.availabilityDate} onChange={updateField} />
                <div className="field listing-form__wide">
                  <span className="field__label">Amenities</span>
                  <div className="listing-form__amenities">{AMENITIES.map((amenity) => <label className="listing-form__amenity" key={amenity}><input type="checkbox" checked={form.amenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} />{amenity}</label>)}</div>
                </div>
                <div className="field listing-form__wide">
                  <span className="field__label">Showing windows</span>
                  <div className="listing-form__showing-windows">{SHOWING_DAYS.map((day) => <div className="listing-form__showing-row" key={day}><label className="listing-form__amenity"><input type="checkbox" checked={form.showingWindows[day].enabled} onChange={(event) => updateShowingWindow(day, "enabled", event.target.checked)} />{day}</label><input className="field__input" type="time" value={form.showingWindows[day].start} disabled={!form.showingWindows[day].enabled} onChange={(event) => updateShowingWindow(day, "start", event.target.value)} aria-label={`${day} showing start`} /><span>to</span><input className="field__input" type="time" value={form.showingWindows[day].end} disabled={!form.showingWindows[day].enabled} onChange={(event) => updateShowingWindow(day, "end", event.target.value)} aria-label={`${day} showing end`} /></div>)}</div>
                </div>
                <Field id="edit-floor" name="floorArea" label="Floor area (sqm)" type="number" value={form.floorArea} onChange={updateField} />
                <Field id="edit-lot" name="lotArea" label="Lot area (sqm)" type="number" value={form.lotArea} onChange={updateField} />
              </div>
            </section>
            <section className="user-page__empty listing-form__section">
              <h2>Photos and verification</h2>
              <p className="listing-form__hint">Keep at least 4 property photos. Existing documents remain valid unless replaced.</p>
              <div className="listing-form__uploads">
                <label className="listing-form__upload"><Upload size={18} aria-hidden="true" /><span>Additional property photos</span><small>{newPhotos.length ? `${newPhotos.length} selected` : `${existingPhotos.length} already saved`}</small><input type="file" accept="image/*" multiple onChange={(event) => setNewPhotos(Array.from(event.target.files || []).slice(0, 8))} /></label>
                <label className="listing-form__upload"><Upload size={18} aria-hidden="true" /><span>Ownership document</span><small>{ownershipDocument?.name || (existingDocuments.ownership ? "Existing private document saved" : existingDocuments.legacyOwnership ? "Re-upload required to protect this document" : "Required")}</small><input type="file" accept="image/*,.pdf" onChange={(event) => setOwnershipDocument(event.target.files?.[0] || null)} /></label>
                <label className="listing-form__upload"><Upload size={18} aria-hidden="true" /><span>Government photo ID</span><small>{governmentId?.name || (existingDocuments.governmentId ? "Existing private ID saved" : existingDocuments.legacyGovernmentId ? "Re-upload required to protect this document" : "Required")}</small><input type="file" accept="image/*,.pdf" onChange={(event) => setGovernmentId(event.target.files?.[0] || null)} /></label>
              </div>
            </section>
            {error && <p className="user-page__form-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn--primary listing-form__submit" disabled={saving}>{saving ? "Saving..." : "Save and submit for review"}</button>
          </form>
        )}
      </main>
    </div>
  );
}

function isDocumentAsset(value) {
  return Boolean(value && typeof value === "object" && value.publicId && value.format && value.resourceType);
}

function Field({ id, name, label, value, onChange, type = "text", step, wide = false }) { return <div className={`field${wide ? " listing-form__wide" : ""}`}><label className="field__label" htmlFor={id}>{label}</label><input id={id} name={name} className="field__input" type={type} min={type === "number" ? "0" : undefined} step={step} value={value} onChange={onChange} required /></div>; }
function SelectField({ id, name, label, value, onChange, options }) { return <div className="field"><label className="field__label" htmlFor={id}>{label}</label><select id={id} name={name} className="field__input" value={value} onChange={onChange} required>{options.map((option) => <option key={option}>{option}</option>)}</select></div>; }
function normalizeShowingWindows(windows = {}) { return Object.fromEntries(SHOWING_DAYS.map((day) => [day, { enabled: Boolean(windows[day]?.enabled), start: windows[day]?.start || "09:00", end: windows[day]?.end || "17:00" }])); }
function listingAssetOptions(id, assetFolder, assetType) { return { assetFolder: `trusthome/listings/${id}/${assetFolder}`, tags: ["trusthome", assetType] }; }
