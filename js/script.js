// ===== Elements =====
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const unitToggle = document.getElementById("unit-toggle");
const themeToggle = document.getElementById("theme-toggle");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-message");
const weatherContent = document.getElementById("weather-content");
const cityName = document.getElementById("city-name");
const currentDate = document.getElementById("current-date");
const weatherIcon = document.getElementById("weather-icon");
const currentTemp = document.getElementById("current-temp");
const weatherDesc = document.getElementById("weather-desc");
const feelsLike = document.getElementById("feels-like");
const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("wind-speed");
const forecastList = document.getElementById("forecast-list");

// ===== Constants =====
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_CITY = "Dhaka";

const CITY_KEY = "weather-app-city";
const UNIT_KEY = "weather-app-unit";
const THEME_KEY = "weather-app-theme";

// WMO weather codes (Open-Meteo) -> description + icon
const WEATHER_CODES = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Mainly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Freezing fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌦️" },
  56: { label: "Freezing drizzle", icon: "🌧️" },
  57: { label: "Heavy freezing drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌧️" },
  67: { label: "Heavy freezing rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "❄️" },
  80: { label: "Light rain showers", icon: "🌦️" },
  81: { label: "Rain showers", icon: "🌧️" },
  82: { label: "Violent rain showers", icon: "⛈️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Heavy snow showers", icon: "❄️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm with hail", icon: "⛈️" },
  99: { label: "Severe thunderstorm with hail", icon: "⛈️" },
};

// ===== State =====
let unit = loadSetting(UNIT_KEY) === "f" ? "f" : "c"; // "c" | "f"
let weatherData = null; // { place, weather }
let latestRequest = 0; // purano slow request jeno notun result overwrite na kore

// ===== localStorage helpers =====
function loadSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // storage na thakleo app chalu thakbe
  }
}

// ===== Theme (dark / light) =====
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
}

function getInitialTheme() {
  const saved = loadSetting(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  saveSetting(THEME_KEY, next);
}

// ===== Unit (°C / °F) =====
function updateUnitButton() {
  unitToggle.textContent = unit === "f" ? "°F" : "°C";
}

function toggleUnit() {
  unit = unit === "c" ? "f" : "c";
  saveSetting(UNIT_KEY, unit);
  updateUnitButton();
  renderWeather(); // notun kore API call lage na
}

function convertTemp(celsius) {
  return unit === "f" ? (celsius * 9) / 5 + 32 : celsius;
}

function formatTemp(celsius) {
  return Math.round(convertTemp(celsius)) + "°";
}

function formatTempWithUnit(celsius) {
  return formatTemp(celsius) + (unit === "f" ? "F" : "C");
}

function formatWind(kmh) {
  return unit === "f"
    ? Math.round(kmh * 0.621371) + " mph"
    : Math.round(kmh) + " km/h";
}

// ===== Date helpers =====
function parseDate(dateString) {
  // "2026-10-03" -> local Date (timezone shift chhara)
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLongDate(dateString) {
  return parseDate(dateString).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatWeekday(dateString) {
  return parseDate(dateString).toLocaleDateString("en-GB", {
    weekday: "short",
  });
}

// ===== Weather helpers =====
function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { label: "Unknown", icon: "🌡️" };
}

// ===== API =====
async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    const error = new Error("Bad response: " + response.status);
    error.userMessage =
      "The weather service is not responding (error " +
      response.status +
      "). Please try again later.";
    throw error;
  }

  return response.json();
}

async function getLocation(city) {
  const url =
    GEO_URL +
    "?name=" +
    encodeURIComponent(city) +
    "&count=1&language=en&format=json";

  const data = await fetchJson(url);

  if (!data.results || data.results.length === 0) {
    const error = new Error("City not found");
    error.userMessage =
      'City "' + city + '" not found. Check the spelling and try again.';
    throw error;
  }

  return data.results[0];
}

async function getWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: latitude,
    longitude: longitude,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "5",
  });

  return fetchJson(FORECAST_URL + "?" + params.toString());
}

// ===== UI state =====
function setLoading(isLoading) {
  loadingEl.hidden = !isLoading;
  searchBtn.disabled = isLoading;

  if (isLoading) {
    errorEl.hidden = true;
  }
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  weatherContent.hidden = true;
}

// ===== Render =====
function createForecastItem(weather, index) {
  const daily = weather.daily;
  const info = getWeatherInfo(daily.weather_code[index]);

  const li = document.createElement("li");
  li.className = "forecast-item";

  const day = document.createElement("span");
  day.className = "forecast-day";
  day.textContent = index === 0 ? "Today" : formatWeekday(daily.time[index]);

  const icon = document.createElement("span");
  icon.className = "forecast-icon";
  icon.textContent = info.icon;
  icon.title = info.label;
  icon.setAttribute("aria-label", info.label);

  const temps = document.createElement("div");
  temps.className = "forecast-temps";

  const max = document.createElement("span");
  max.className = "temp-max";
  max.textContent = formatTemp(daily.temperature_2m_max[index]);

  const min = document.createElement("span");
  min.className = "temp-min";
  min.textContent = formatTemp(daily.temperature_2m_min[index]);

  temps.append(max, min);
  li.append(day, icon, temps);
  return li;
}

function renderWeather() {
  if (!weatherData) return;

  const { place, weather } = weatherData;
  const current = weather.current;
  const info = getWeatherInfo(current.weather_code);

  cityName.textContent = place.country
    ? place.name + ", " + place.country
    : place.name;
  currentDate.textContent = formatLongDate(current.time.split("T")[0]);

  weatherIcon.textContent = info.icon;
  currentTemp.textContent = formatTempWithUnit(current.temperature_2m);
  weatherDesc.textContent = info.label;

  feelsLike.textContent = formatTempWithUnit(current.apparent_temperature);
  humidity.textContent = Math.round(current.relative_humidity_2m) + "%";
  windSpeed.textContent = formatWind(current.wind_speed_10m);

  forecastList.innerHTML = "";
  weather.daily.time.forEach((_, index) => {
    forecastList.appendChild(createForecastItem(weather, index));
  });
}

// ===== Search =====
async function searchCity(city) {
  const cleanCity = city.trim();

  if (cleanCity === "") {
    showError("Please enter a city name.");
    return;
  }

  const requestId = ++latestRequest;
  setLoading(true);

  try {
    const place = await getLocation(cleanCity);
    const weather = await getWeather(place.latitude, place.longitude);

    if (requestId !== latestRequest) return; // notun search hoye gele eta ignore

    weatherData = { place, weather };
    saveSetting(CITY_KEY, place.name);
    renderWeather();
    weatherContent.hidden = false;
  } catch (error) {
    if (requestId !== latestRequest) return;

    showError(
      error.userMessage ||
        "Could not load weather. Check your internet connection and try again."
    );
  } finally {
    if (requestId === latestRequest) {
      setLoading(false);
    }
  }
}

// ===== Events =====
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchCity(cityInput.value);
});

unitToggle.addEventListener("click", toggleUnit);
themeToggle.addEventListener("click", toggleTheme);

// ===== Start =====
applyTheme(getInitialTheme());
updateUnitButton();
searchCity(loadSetting(CITY_KEY) || DEFAULT_CITY);