const resultGrid = document.getElementById("resultGrid");
const faceUpload = document.getElementById("faceUpload");
const facePreview = document.getElementById("facePreview");
const loadingOverlay = document.getElementById("loadingOverlay");

// Fungsi upload wajah
function uploadFace() {
  const files = faceUpload.files;
  if (!files.length) {
    alert("Pilih foto dulu!");
    return;
  }

  // Hapus preview lama & hasil
  facePreview.innerHTML = "";
  resultGrid.innerHTML = "";

  // Tampilkan overlay loading
  loadingOverlay.classList.add("active");

  // Simulasi proses (2.5 detik)
  setTimeout(() => {
    loadingOverlay.classList.remove("active");

    // Preview + hasil
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        // Preview di atas
        const img = document.createElement("img");
        img.src = e.target.result;
        facePreview.appendChild(img);

        // Buat card hasil
        const card = document.createElement("div");
        card.classList.add("result-card");

        // Buat elemen download
        const downloadLink = document.createElement("a");
        downloadLink.href = e.target.result;
        downloadLink.download = `swapface-${Date.now()}.png`;

        const downloadBtn = document.createElement("button");
        downloadBtn.textContent = "Download";

        downloadLink.appendChild(downloadBtn);

        card.innerHTML = `<img src="${e.target.result}" alt="Hasil Swap">`;
        card.appendChild(downloadLink);

        resultGrid.appendChild(card);
      };
      reader.readAsDataURL(file);
    });
  }, 2500); // delay 2.5 detik
}

// Preview template pakaian
function previewTemplate(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const previewDiv = input.nextElementSibling.nextElementSibling;
    previewDiv.innerHTML = `<img src="${e.target.result}" alt="Template">`;
  };
  reader.readAsDataURL(file);
}
