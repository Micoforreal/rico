// Seed script: posts to /api/seed to initialize demo users
async function seed() {
  console.log("Starting seed process...");
  try {
    const res = await fetch("http://localhost:3000/api/seed", {
      method: "POST"
    });
    const data = await res.json();
    if (res.ok) {
      console.log("Seed successful:", data);
    } else {
      console.error("Seed failed:", data);
    }
  } catch (err) {
    console.error("Network error during seed:", err);
  }
}

seed();
