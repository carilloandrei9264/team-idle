import { useEffect, useRef, useState } from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { ArrowLeft, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import PropertyMap from "../components/PropertyMap";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { countWords, SHOWING_DAYS, validateListingForm } from "../lib/listingValidation";
import { ADMIN_NOTIFICATION_RECIPIENT, createNotification, NOTIFICATION_TYPES } from "../lib/notifications";
import { documentResourceType, uploadPrivateDocument, uploadToCloudinary } from "../uploadImage";
import { signPrivateDocumentUpload } from "../services/api";
import "./UserPages.css";

const PROPERTY_TYPES = ["Room", "Studio", "Apartment", "House", "Condo", "Land"];
const AMENITIES = ["Parking", "WiFi", "Furnished", "Pets allowed", "Air conditioning", "Security"];

export default function CreateListing() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "Apartment",
    listingPurpose: "rent",
    rentalTerm: "long_term",
    address: "",
    city: "",
    price: "",
    pricePeriod: "month",
    bedrooms: "",
    bathrooms: "",
    floorArea: "",
    lotArea: "",
    availabilityDate: "",
    amenities: [],
    showingWindows: Object.fromEntries(SHOWING_DAYS.map((day) => [day, { enabled: false, start: "09:00", end: "17:00" }])),
  });
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [ownershipDocument, setOwnershipDocument] = useState(null);
  const [ownershipPreview, setOwnershipPreview] = useState(null);
  const [governmentId, setGovernmentId] = useState(null);
  const [governmentIdPreview, setGovernmentIdPreview] = useState(null);
  const [mapLocation, setMapLocation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const previewUrls = useRef(new Set());

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateListingPurpose(listingPurpose) {
    setForm((current) => {
      const rentalTerm = current.rentalTerm || "long_term";
      return {
        ...current,
        listingPurpose,
        rentalTerm,
        pricePeriod: listingPurpose === "sale" ? "total" : rentalTerm === "short_term" ? "day" : "month",
      };
    });
  }

  function updateRentalTerm(rentalTerm) {
    setForm((current) => ({
      ...current,
      rentalTerm,
      pricePeriod: rentalTerm === "short_term" ? "day" : "month",
    }));
  }

  function handlePhotos(event) {
    const nextPhotos = Array.from(event.target.files || []).slice(0, 8);
    releasePreviewUrls(photoPreviews);
    const nextPreviews = nextPhotos.map((file) => createFilePreview(file));
    setPhotos(nextPhotos);
    setPhotoPreviews(nextPreviews);
  }

  function handleDocument(event, currentPreview, setDocument, setPreview) {
    const file = event.target.files?.[0] || null;
    releasePreviewUrls(currentPreview ? [currentPreview] : []);
    setDocument(file);
    setPreview(file ? createFilePreview(file) : null);
  }

  function createFilePreview(file) {
    const url = URL.createObjectURL(file);
    previewUrls.current.add(url);
    return { file, url };
  }

  function releasePreviewUrls(previews) {
    previews.forEach(({ url }) => {
      URL.revokeObjectURL(url);
      previewUrls.current.delete(url);
    });
  }

  function toggleAmenity(amenity) {
    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }));
  }

  function updateShowingWindow(day, field, value) {
    setForm((current) => ({
      ...current,
      showingWindows: {
        ...current.showingWindows,
        [day]: { ...current.showingWindows[day], [field]: value },
      },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validateListingForm({ form, photos, ownershipDocument, governmentId, mapLocation });
    if (validationErrors.length) {
      setError(validationErrors.join(" "));
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const listingRef = doc(collection(db, "listings"));
      const privateListingRef = doc(db, "listingPrivate", listingRef.id);
      const ownershipResourceType = documentResourceType(ownershipDocument) === "raw" ? "raw" : "image";
      const governmentIdResourceType = documentResourceType(governmentId) === "raw" ? "raw" : "image";
      const [ownershipSignature, governmentIdSignature, photoUrls] = await Promise.all([
        signPrivateDocumentUpload(listingRef.id, "ownership", ownershipResourceType),
        signPrivateDocumentUpload(listingRef.id, "govId", governmentIdResourceType),
        Promise.all(photos.map((photo) => uploadToCloudinary(photo, "auto", listingAssetOptions(listingRef.id, "photos", "property-photo")))),
      ]);
      const [ownershipDocumentAsset, governmentIdAsset] = await Promise.all([
        uploadPrivateDocument(ownershipDocument, ownershipSignature, ownershipResourceType),
        uploadPrivateDocument(governmentId, governmentIdSignature, governmentIdResourceType),
      ]);

      const batch = writeBatch(db);
      batch.set(listingRef, {
        ownerId: user.uid,
        ownerName: profile?.name || user.displayName || user.email,
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        listingPurpose: form.listingPurpose,
        rentalTerm: form.listingPurpose === "rent" ? form.rentalTerm : null,
        city: form.city.trim(),
        mapLocation,
        price: Number(form.price),
        pricePeriod: form.pricePeriod,
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        floorArea: form.floorArea ? Number(form.floorArea) : null,
        lotArea: form.lotArea ? Number(form.lotArea) : null,
        availabilityDate: form.availabilityDate,
        amenities: form.amenities,
        showingWindows: form.showingWindows,
        verificationStatus: "pending",
        photoUrls,
        createdAt: serverTimestamp(),
      });
      batch.set(privateListingRef, {
        ownerId: user.uid,
        address: form.address.trim(),
        documents: {
          ownership: ownershipDocumentAsset,
          govId: governmentIdAsset,
        },
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      let adminAlertSent = true;
      try {
        await createNotification(db, {
          recipientId: ADMIN_NOTIFICATION_RECIPIENT,
          createdBy: user.uid,
          type: NOTIFICATION_TYPES.LISTING_SUBMITTED,
          title: "New listing submitted for review",
          message: `${form.title.trim()} is ready for verification review.`,
          link: `/admin/listings?listingId=${listingRef.id}`,
          entityId: listingRef.id,
          entityType: "listing",
        });
      } catch {
        adminAlertSent = false;
      }
      navigate("/my-listings", {
        replace: true,
        state: {
          submissionNotice: adminAlertSent
            ? "Listing submitted for review."
            : "Listing submitted, but the admin alert could not be delivered. It remains in the review queue.",
        },
      });
    } catch (uploadError) {
      setError(uploadError.message || "Your listing could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content user-page__content--form">
        <Link to="/my-listings" className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> My listings</Link>
        <header className="user-page__header">
          <div>
            <p className="user-page__eyebrow">List a property</p>
            <h1>Create listing</h1>
            <p>Your listing will stay private until an admin reviews the submitted document.</p>
          </div>
        </header>

        <form className="listing-form" onSubmit={handleSubmit}>
          <section className="user-page__empty listing-form__section">
            <h2>Property details</h2>
            <div className="listing-form__grid">
              <div className="field listing-form__wide">
                <label className="field__label" htmlFor="title">Listing title</label>
                <input id="title" name="title" className="field__input" value={form.title} onChange={updateField} placeholder="e.g. Bright two-bedroom apartment" required />
              </div>
              <div className="field listing-form__wide">
                <label className="field__label" htmlFor="description">Description</label>
                <textarea id="description" name="description" className="listing-form__textarea" value={form.description} onChange={updateField} rows={8} placeholder="Describe the property accurately, including layout, condition, access, and nearby landmarks." required />
                <small className="listing-form__hint">{countWords(form.description)} words · recommended 150-400 words</small>
              </div>
              <div className="field listing-form__wide">
                <span className="field__label">Listing purpose</span>
                <div className="listing-form__purpose-options" role="radiogroup" aria-label="Listing purpose">
                  <label className={`listing-form__purpose-option${form.listingPurpose === "rent" ? " listing-form__purpose-option--selected" : ""}`}>
                    <input type="radio" name="listingPurpose" value="rent" checked={form.listingPurpose === "rent"} onChange={() => updateListingPurpose("rent")} />
                    <span><strong>For rent</strong><small>Short stays or long-term homes</small></span>
                  </label>
                  <label className={`listing-form__purpose-option${form.listingPurpose === "sale" ? " listing-form__purpose-option--selected" : ""}`}>
                    <input type="radio" name="listingPurpose" value="sale" checked={form.listingPurpose === "sale"} onChange={() => updateListingPurpose("sale")} />
                    <span><strong>For sale</strong><small>One-time asking price</small></span>
                  </label>
                </div>
              </div>
              {form.listingPurpose === "rent" && (
                <div className="field">
                  <label className="field__label" htmlFor="rentalTerm">Rental term</label>
                  <select id="rentalTerm" className="field__input" value={form.rentalTerm} onChange={(event) => updateRentalTerm(event.target.value)}>
                    <option value="short_term">Short-term stay · per night</option>
                    <option value="long_term">Long-term home · per month</option>
                  </select>
                </div>
              )}
              <div className="field">
                <label className="field__label" htmlFor="type">Property type</label>
                <select id="type" name="type" className="field__input" value={form.type} onChange={updateField}>{PROPERTY_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="address">Private address or area</label>
                <input id="address" name="address" className="field__input" value={form.address} onChange={updateField} placeholder="Exact address or neighborhood" required />
                <small className="listing-form__hint">Visible only to you and TrustHome admins.</small>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="city">City</label>
                <input id="city" name="city" className="field__input" value={form.city} onChange={updateField} placeholder="e.g. Cabuyao" required />
              </div>
              <div className="field listing-form__wide">
                <span className="field__label">Approximate map location (optional)</span>
                <PropertyMap location={mapLocation} onLocationChange={setMapLocation} addressHint={form.address} />
                {mapLocation && <button type="button" className="btn btn--secondary" onClick={() => setMapLocation(null)}>Remove map pin</button>}
              </div>
              <div className="field">
                <label className="field__label" htmlFor="price">{form.listingPurpose === "sale" ? "Asking price" : form.rentalTerm === "short_term" ? "Price per night" : "Price per month"}</label>
                <input id="price" name="price" type="number" min="1" className="field__input" value={form.price} onChange={updateField} placeholder="₱0" required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="bedrooms">Bedrooms</label>
                <input id="bedrooms" name="bedrooms" type="number" min="0" className="field__input" value={form.bedrooms} onChange={updateField} required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="bathrooms">Bathrooms</label>
                <input id="bathrooms" name="bathrooms" type="number" min="0" step="0.5" className="field__input" value={form.bathrooms} onChange={updateField} required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="availabilityDate">Available from</label>
                <input id="availabilityDate" name="availabilityDate" type="date" className="field__input" value={form.availabilityDate} onChange={updateField} required />
              </div>
              <div className="field listing-form__wide">
                <span className="field__label">Amenities</span>
                <div className="listing-form__amenities">
                  {AMENITIES.map((amenity) => <label className="listing-form__amenity" key={amenity}><input type="checkbox" checked={form.amenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} />{amenity}</label>)}
                </div>
              </div>
              <div className="field listing-form__wide">
                <span className="field__label">Showing windows</span>
                <div className="listing-form__showing-windows">
                  {SHOWING_DAYS.map((day) => <div className="listing-form__showing-row" key={day}>
                    <label className="listing-form__amenity"><input type="checkbox" checked={form.showingWindows[day].enabled} onChange={(event) => updateShowingWindow(day, "enabled", event.target.checked)} />{day}</label>
                    <input className="field__input" type="time" value={form.showingWindows[day].start} disabled={!form.showingWindows[day].enabled} onChange={(event) => updateShowingWindow(day, "start", event.target.value)} aria-label={`${day} showing start`} />
                    <span>to</span>
                    <input className="field__input" type="time" value={form.showingWindows[day].end} disabled={!form.showingWindows[day].enabled} onChange={(event) => updateShowingWindow(day, "end", event.target.value)} aria-label={`${day} showing end`} />
                  </div>)}
                </div>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="floorArea">Floor area (sqm)</label>
                <input id="floorArea" name="floorArea" type="number" min="0" className="field__input" value={form.floorArea} onChange={updateField} placeholder="Optional" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="lotArea">Lot area (sqm)</label>
                <input id="lotArea" name="lotArea" type="number" min="0" className="field__input" value={form.lotArea} onChange={updateField} placeholder="Optional" />
              </div>
            </div>
          </section>

          <section className="user-page__empty listing-form__section">
            <h2>Photos and verification</h2>
            <p className="listing-form__hint">Upload at least 4 photos, one ownership document, and one government-issued photo ID. Do not upload real identity or ownership documents to this test build: uploaded document URLs are not yet access-restricted.</p>
            <div className="listing-form__uploads">
              <label className="listing-form__upload">
                <Upload size={18} aria-hidden="true" />
                <span>Property photos</span>
                <small>{photos.length ? `${photos.length} selected` : "At least 4 images"}</small>
                <input type="file" accept="image/*" multiple onChange={handlePhotos} />
              </label>
              <label className="listing-form__upload">
                <Upload size={18} aria-hidden="true" />
                <span>Ownership document</span>
                <small>{ownershipDocument?.name || "Title, deed, or tax bill"}</small>
                <input type="file" accept="image/*,.pdf" onChange={(event) => handleDocument(event, ownershipPreview, setOwnershipDocument, setOwnershipPreview)} required />
              </label>
              <label className="listing-form__upload">
                <Upload size={18} aria-hidden="true" />
                <span>Government photo ID</span>
                <small>{governmentId?.name || "Required for review"}</small>
                <input type="file" accept="image/*,.pdf" onChange={(event) => handleDocument(event, governmentIdPreview, setGovernmentId, setGovernmentIdPreview)} required />
              </label>
            </div>
            {photos.length > 0 && (
              <div className="listing-form__file-previews listing-form__file-previews--photos">
                <p className="field__label listing-form__wide">Property photo previews ({photos.length})</p>
                {photoPreviews.map((preview, index) => (
                  <FilePreview key={`${preview.file.name}-${preview.file.lastModified}-${index}`} preview={preview} label={`Property photo ${index + 1}`} />
                ))}
              </div>
            )}
            {(ownershipDocument || governmentId) && (
              <div className="listing-form__file-previews listing-form__file-previews--documents">
                {ownershipPreview && <FilePreview preview={ownershipPreview} label="Ownership document" />}
                {governmentIdPreview && <FilePreview preview={governmentIdPreview} label="Government photo ID" />}
              </div>
            )}
          </section>

          {error && <p className="user-page__form-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn--primary listing-form__submit" disabled={submitting}>
            {submitting ? "Uploading and submitting..." : "Submit for review"}
          </button>
        </form>
      </main>
    </div>
  );
}

function FilePreview({ preview, label }) {
  const { file, url } = preview;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  return (
    <figure className="listing-form__file-preview">
      {isPdf ? (
        <iframe className="listing-form__file-preview-pdf" src={url} title={`${label} preview`} />
      ) : (
        <img className="listing-form__file-preview-image" src={url} alt={`${label}: ${file.name}`} />
      )}
      <figcaption>
        <strong>{label}</strong>
        <span title={file.name}>{file.name}</span>
      </figcaption>
    </figure>
  );
}

function listingAssetOptions(listingId, assetFolder, assetType) {
  return {
    assetFolder: `trusthome/listings/${listingId}/${assetFolder}`,
    tags: ["trusthome", assetType],
  };
}