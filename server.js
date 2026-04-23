const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

let needs = [];
let volunteers = [];
let ngos = [];

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend connected successfully 🚀" });
});

// Health route
app.get("/", (req, res) => {
  res.send("Backend is running");
});

// Add NGO
app.post("/add-ngo", (req, res) => {
  const { name, location } = req.body;

  if (!name || !location) {
    return res.status(400).json({ message: "NGO name and location are required" });
  }

  const ngo = {
    id: Date.now(),
    name,
    location
  };

  ngos.push(ngo);
  res.json({ message: "NGO added successfully", ngo });
});

// Add need
app.post("/add-need", (req, res) => {
  const { description, location, urgency } = req.body;

  if (!description || !location || !urgency) {
    return res.status(400).json({ message: "Description, location, and urgency are required" });
  }

  const need = {
  id: Date.now(),
  description,
  location,
  urgency,
  lat: req.body.lat ?? null,
  lng: req.body.lng ?? null
};

  needs.push(need);
  res.json({ message: "Need added successfully", need });
});

// Add volunteer
app.post("/add-volunteer", (req, res) => {
  const { name, skill, location } = req.body;

  if (!name || !skill || !location) {
    return res.status(400).json({ message: "Name, skill, and location are required" });
  }

 const volunteer = {
  id: Date.now(),
  name,
  skill,
  location,
  lat: req.body.lat ?? null,
  lng: req.body.lng ?? null
};
  volunteers.push(volunteer);
  res.json({ message: "Volunteer added successfully", volunteer });
});

// Get all data
app.get("/data", (req, res) => {
  res.json({ ngos, needs, volunteers });
});

// Get only NGOs
app.get("/ngos", (req, res) => {
  res.json(ngos);
});

// Get only needs
app.get("/needs", (req, res) => {
  res.json(needs);
});

// Get only volunteers
app.get("/volunteers", (req, res) => {
  res.json(volunteers);
});

// Basic matching route
app.get("/matches", (req, res) => {
  const matches = needs.map((need) => {
    const matchedVolunteer = volunteers.find(
      (volunteer) =>
        volunteer.skill.toLowerCase().includes(need.description.toLowerCase()) ||
        need.description.toLowerCase().includes(volunteer.skill.toLowerCase()) ||
        volunteer.location.toLowerCase() === need.location.toLowerCase()
    );

    return matchedVolunteer
      ? {
          need,
          volunteer: matchedVolunteer
        }
      : null;
  }).filter(Boolean);

  res.json(matches);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});