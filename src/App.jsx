
import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import "./App.css";

const CLOUD_NAME = "fgoovf5n";
const UPLOAD_PRESET = "birthday_card_upload_2026";

function getSharedCard() {
  const hash = window.location.hash;

  if (!hash.startsWith("#card?")) return null;

  const params = new URLSearchParams(hash.substring(6));

  let sharedPhotos = [];

  try {
    sharedPhotos = JSON.parse(params.get("photos") || "[]");
  } catch {
    sharedPhotos = [];
  }

  return {
    name: params.get("name") || "",
    message: params.get("message") || "",
    theme: params.get("theme") || "pink",
    template: params.get("template") || "cute",
    sender: params.get("sender") || "",
    birthdayDate: params.get("birthdayDate") || "",
    photos: sharedPhotos,
  };
}

function getNextBirthdayDate(dateString, now = new Date()) {
  if (!dateString) return null;

  const [, month, day] = dateString.split("-").map(Number);

  const birthday = new Date(now.getFullYear(), month - 1, day);

  if (
    birthday.getMonth() !== month - 1 ||
    birthday.getDate() !== day
  ) return null;

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  if (birthday < today) {
    birthday.setFullYear(now.getFullYear() + 1);
  }

  return birthday;
}

function App() {
  const sharedCard = getSharedCard();

  const [name, setName] = useState(sharedCard?.name || "");
  const [message, setMessage] = useState(sharedCard?.message || "");
  const [sender, setSender] = useState(sharedCard?.sender || "");

  const [birthdayDate, setBirthdayDate] = useState(
    sharedCard?.birthdayDate || ""
  );

  const [currentTime, setCurrentTime] = useState(Date.now());

  const [music, setMusic] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef(null);
  const cardRef = useRef(null);

  const [theme, setTheme] = useState(sharedCard?.theme || "pink");

  const [template, setTemplate] = useState(
    sharedCard?.template || "cute"
  );

  const [photos, setPhotos] = useState(
    sharedCard?.photos || []
  );

  const [stage, setStage] = useState(
    sharedCard ? "card" : "form"
  );

  const [isEnvelopeOpening, setIsEnvelopeOpening] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getCountdown = () => {
    if (!birthdayDate) return null;

    const birthday = getNextBirthdayDate(
      birthdayDate,
      new Date(currentTime)
    );

    if (!birthday) return null;

    const difference = Math.max(
      0,
      birthday.getTime() - currentTime
    );

    return {
      days: Math.floor(difference / 86400000),
      hours: Math.floor((difference / 3600000) % 24),
      minutes: Math.floor((difference / 60000) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  };

  // Select multiple birthday photos
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);

    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();

      reader.onloadend = () => {
        setPhotos((previous) => [
          ...previous,
          {
            preview: reader.result,
            url: "",
          },
        ]);
      };

      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  // Remove a photo
  const removePhoto = (index) => {
    setPhotos((previous) =>
      previous.filter((_, i) => i !== index)
    );
  };

  // Upload photos to Cloudinary
  const uploadPhotosToCloudinary = async () => {
    const uploadedPhotos = [];

    for (const photo of photos) {
      if (photo.url) {
        uploadedPhotos.push(photo.url);
        continue;
      }

      const formData = new FormData();

      formData.append("file", photo.preview);
      formData.append("upload_preset", UPLOAD_PRESET);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message || "Photo upload failed"
        );
      }

      uploadedPhotos.push(data.secure_url);
    }

    return uploadedPhotos.map((url) => ({
      preview: url,
      url,
    }));
  };

  // Create birthday card after uploading photos
  const handleCreateCard = async () => {
    if (!name.trim() || isUploading) return;

    setIsUploading(true);

    try {
      const uploadedPhotos = await uploadPhotosToCloudinary();

      setPhotos(uploadedPhotos);
      setStage("envelope");
    } catch (error) {
      console.error(error);

      alert(
        "Photo upload failed. Please check your Cloudinary preset and try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const openEnvelope = () => {
    if (isEnvelopeOpening) return;

    setIsEnvelopeOpening(true);

    setTimeout(() => {
      setStage("card");
    }, 900);
  };

  // Share birthday card
  const handleShare = async () => {
    const params = new URLSearchParams({
      name,
      message,
      theme,
      template,
      sender,
      birthdayDate,
      photos: JSON.stringify(
        photos.map((photo) => photo.url).filter(Boolean)
      ),
    });

    const link =
      window.location.origin +
      window.location.pathname +
      "#card?" +
      params.toString();

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Birthday Surprise!",
          text: `A special birthday card for ${name}!`,
          url: link,
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          console.log(error);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(link);
        alert("Birthday card link copied! 💗");
      } catch {
        prompt("Copy your birthday card link:", link);
      }
    }
  };

  // Download birthday card
  const downloadCard = async () => {
    if (!cardRef.current) return;

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });

      const link = document.createElement("a");

      link.download = `birthday-card-${name}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error(error);
      alert("Unable to download the card. Please try again.");
    }
  };

  // Music control
  const toggleMusic = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch {
        alert("Please select a music file first! 🎵");
      }
    }
  };

  // Reset card
  const resetCard = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    window.location.hash = "";

    setName("");
    setMessage("");
    setSender("");
    setBirthdayDate("");
    setPhotos([]);
    setMusic("");
    setIsPlaying(false);
    setTheme("pink");
    setTemplate("cute");
    setIsEnvelopeOpening(false);
    setStage("form");
  };

  const countdown = getCountdown();

  return (
    <div className={`page theme-${theme}`}>

      <div className="floating-hearts">
        <span>💗</span>
        <span>💕</span>
        <span>💖</span>
        <span>💗</span>
        <span>🌸</span>
        <span>💕</span>
      </div>

      <nav className="navbar">
        <h2>♡ Sweet Wishes</h2>
        <span>Made with love</span>
      </nav>

      <main className="container">

        {/* BIRTHDAY FORM */}

        {stage === "form" && (
          <div className="content">

            <div className="heart">💗</div>

            <p className="small-title">
              A LITTLE SURPRISE FOR YOU
            </p>

            <h1>
              Make Someone's
              <br />
              Birthday <span>Special!</span>
            </h1>

            <p className="description">
              Create a beautiful birthday surprise
              for someone you love.
            </p>

            <div className="form">

              <label>Birthday person's name</label>

              <input
                type="text"
                placeholder="Enter their name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <label>Birthday Date 🎂</label>

              <input
                type="date"
                value={birthdayDate}
                onChange={(e) => setBirthdayDate(e.target.value)}
              />

              <label>Your birthday message</label>

              <textarea
                placeholder="Write a lovely birthday wish..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />

              <label>From whom? 💌</label>

              <input
                type="text"
                placeholder="With love, from Neha..."
                value={sender}
                onChange={(e) => setSender(e.target.value)}
              />

              <label>Upload Birthday Photos 📸</label>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
              />

              {photos.length > 0 && (
                <div className="photo-gallery">

                  {photos.map((photo, index) => (
                    <div className="preview-item" key={index}>

                      <img
                        src={photo.preview}
                        alt={`Birthday preview ${index + 1}`}
                      />

                      <button
                        type="button"
                        className="remove-photo"
                        onClick={() => removePhoto(index)}
                      >
                        ✕
                      </button>

                    </div>
                  ))}

                </div>
              )}

              <label>Choose your birthday theme</label>

              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="pink">💕 Pink Love</option>
                <option value="purple">💜 Purple Dream</option>
                <option value="blue">💙 Blue Sky</option>
                <option value="gold">✨ Golden Wishes</option>
              </select>

              <label>Choose your card design</label>

              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                <option value="cute">🎀 Cute Birthday</option>
                <option value="elegant">🌸 Elegant Birthday</option>
                <option value="classic">✨ Classic Birthday</option>
              </select>

              <label>Upload Birthday Music 🎵</label>

              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files[0];

                  if (file) {
                    setMusic(URL.createObjectURL(file));
                  }
                }}
              />

              <button
                disabled={!name.trim() || isUploading}
                onClick={handleCreateCard}
              >
                {isUploading
                  ? "Uploading Photos... 💗"
                  : "Create Birthday Card ♡"}
              </button>

            </div>
          </div>
        )}

        {/* ENVELOPE */}

        {stage === "envelope" && (
          <div className="envelope-section">

            <p className="small-title">
              YOU HAVE A SPECIAL SURPRISE
            </p>

            <h1>A Little Gift For You! 💗</h1>

            <p className="description">
              Tap the envelope to open your birthday wish.
            </p>

            <div
              className={`envelope ${
                isEnvelopeOpening ? "opening" : ""
              }`}
              onClick={openEnvelope}
            >
              <div className="envelope-back"></div>
              <div className="envelope-paper">💌</div>
              <div className="envelope-flap"></div>
              <div className="envelope-front"></div>
              <div className="envelope-heart">♡</div>
            </div>

            <button
              className="open-button"
              onClick={openEnvelope}
              disabled={isEnvelopeOpening}
            >
              {isEnvelopeOpening
                ? "Opening your surprise... 💗"
                : "Open Your Surprise 💕"}
            </button>

          </div>
        )}

        {/* BIRTHDAY CARD */}

        {stage === "card" && (
          <div
            className={`birthday-card template-${template}`}
            ref={cardRef}
          >

            <div className="confetti">
              🎉 ✨ 🎊 💖 🎉 ✨
            </div>

            {/* FIREWORKS */}

            <div className="fireworks" aria-hidden="true">
              <span className="firework burst-one"></span>
              <span className="firework burst-two"></span>
              <span className="firework burst-three"></span>
              <span className="firework burst-four"></span>
            </div>

            {music && (
              <>
                <audio
                  ref={audioRef}
                  src={music}
                  loop
                  onEnded={() => setIsPlaying(false)}
                />

                <button onClick={toggleMusic}>
                  {isPlaying
                    ? "⏸ Pause Music"
                    : "🎵 Play Birthday Music"}
                </button>
              </>
            )}

            <div className="cake">🎂</div>

            <p className="small-title">
              TODAY IS YOUR SPECIAL DAY
            </p>

            <h1>Happy Birthday!</h1>

            <h2>{name} 💗</h2>

            <p>
              {message ||
                "Wishing you endless happiness, love and beautiful memories!"}
            </p>

            {/* BIRTHDAY PHOTO GALLERY */}

            {photos.length > 0 && (
              <div className="birthday-gallery">

                {photos.map((photo, index) => (
                  <div className="gallery-item" key={index}>
                    <img
                      src={photo.url || photo.preview}
                      alt={`Birthday memory ${index + 1}`}
                      crossOrigin="anonymous"
                    />
                  </div>
                ))}

              </div>
            )}

            <div className="card-hearts">
              🌸 💕 🌸
            </div>

            {/* COUNTDOWN */}

            {countdown && (
              <div className="birthday-countdown">

                <h3>Birthday Countdown 🎉</h3>

                <div className="countdown-values">

                  {Object.entries(countdown).map(([unit, value]) => (
                    <div className="countdown-item" key={unit}>
                      <strong>
                        {String(value).padStart(2, "0")}
                      </strong>
                      <span>{unit}</span>
                    </div>
                  ))}

                </div>
              </div>
            )}

            {birthdayDate && !countdown && (
              <p>Invalid birthday date. Please select another date.</p>
            )}

            {sender && (
              <p className="sender-name">
                With love, {sender} 💗
              </p>
            )}

            <button onClick={handleShare}>
              Share Birthday Card 💌
            </button>

            <button
              onClick={downloadCard}
              className="download-button"
            >
              Download Birthday Card 📥
            </button>

            <button
              className="secondary-button"
              onClick={resetCard}
            >
              Create Another Card ♡
            </button>

          </div>
        )}

      </main>

      <footer>
        Made with ♡ for someone special
      </footer>

    </div>
  );
}

export default App;
