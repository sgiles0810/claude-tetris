#!/usr/bin/env python3
"""Consulta el clima actual y el pronostico de 3 dias.

Usa APIs publicas sin API key:
- https://ipinfo.io/json               (geolocalizacion por IP)
- https://geocoding-api.open-meteo.com (geocodificacion de ciudades)
- https://api.open-meteo.com           (clima actual + pronostico)

Solo usa la libreria estandar de Python (urllib, json, argparse).
"""

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

USER_AGENT = "clima-skill/1.0 (+https://claude.com/claude-code)"

WMO = {
    0: "Despejado",
    1: "Mayormente despejado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Niebla",
    48: "Niebla con escarcha",
    51: "Llovizna ligera",
    53: "Llovizna moderada",
    55: "Llovizna intensa",
    56: "Llovizna helada ligera",
    57: "Llovizna helada intensa",
    61: "Lluvia ligera",
    63: "Lluvia moderada",
    65: "Lluvia intensa",
    66: "Lluvia helada ligera",
    67: "Lluvia helada intensa",
    71: "Nieve ligera",
    73: "Nieve moderada",
    75: "Nieve intensa",
    77: "Granos de nieve",
    80: "Chubascos ligeros",
    81: "Chubascos moderados",
    82: "Chubascos violentos",
    85: "Chubascos de nieve ligeros",
    86: "Chubascos de nieve intensos",
    95: "Tormenta",
    96: "Tormenta con granizo ligero",
    99: "Tormenta con granizo intenso",
}

DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]


def weather_desc(code):
    return WMO.get(code, f"Código {code}")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        sys.exit(f"Error HTTP {e.code} al consultar {url}")
    except urllib.error.URLError as e:
        sys.exit(f"No se pudo conectar ({e.reason}). Revisa tu conexión a internet.")
    except TimeoutError:
        sys.exit("La consulta tardó demasiado (timeout). Intenta de nuevo.")


def locate_by_ip():
    data = fetch("https://ipinfo.io/json")
    loc = data.get("loc")
    if not loc or "," not in loc:
        sys.exit("No se pudo determinar tu ubicación por IP.")
    lat_str, lon_str = loc.split(",", 1)
    label = ", ".join(
        part for part in (data.get("city"), data.get("country")) if part
    )
    return float(lat_str), float(lon_str), label or "tu ubicación"


def geocode(nombre):
    qs = urllib.parse.urlencode(
        {"name": nombre, "count": 1, "language": "es", "format": "json"}
    )
    data = fetch(f"https://geocoding-api.open-meteo.com/v1/search?{qs}")
    results = data.get("results") or []
    if not results:
        sys.exit(f"No encontré la ciudad «{nombre}».")
    r = results[0]
    label = ", ".join(
        part for part in (r.get("name"), r.get("country")) if part
    )
    return r["latitude"], r["longitude"], label


def forecast(lat, lon):
    qs = urllib.parse.urlencode(
        {
            "latitude": lat,
            "longitude": lon,
            "current": (
                "temperature_2m,relative_humidity_2m,apparent_temperature,"
                "precipitation,weather_code,wind_speed_10m"
            ),
            "daily": (
                "weather_code,temperature_2m_max,temperature_2m_min,"
                "precipitation_probability_max"
            ),
            "timezone": "auto",
            "forecast_days": 3,
        }
    )
    return fetch(f"https://api.open-meteo.com/v1/forecast?{qs}")


def build_result(label, data):
    cur = data["current"]
    cur_units = data["current_units"]
    daily = data["daily"]
    daily_units = data["daily_units"]

    days = []
    for i, iso_date in enumerate(daily["time"]):
        y, m, d = (int(x) for x in iso_date.split("-"))
        dow = DIAS[date(y, m, d).weekday()]
        days.append(
            {
                "date": iso_date,
                "day_label": f"{dow} {d:02d}",
                "weather_code": daily["weather_code"][i],
                "condition": weather_desc(daily["weather_code"][i]),
                "temp_min": daily["temperature_2m_min"][i],
                "temp_max": daily["temperature_2m_max"][i],
                "precipitation_probability_max": daily[
                    "precipitation_probability_max"
                ][i],
            }
        )

    return {
        "location": {"label": label, "timezone": data.get("timezone")},
        "current": {
            "time": cur["time"],
            "temperature": cur["temperature_2m"],
            "temperature_unit": cur_units["temperature_2m"],
            "apparent_temperature": cur["apparent_temperature"],
            "humidity": cur["relative_humidity_2m"],
            "humidity_unit": cur_units["relative_humidity_2m"],
            "wind_speed": cur["wind_speed_10m"],
            "wind_speed_unit": cur_units["wind_speed_10m"],
            "precipitation": cur["precipitation"],
            "precipitation_unit": cur_units["precipitation"],
            "weather_code": cur["weather_code"],
            "condition": weather_desc(cur["weather_code"]),
        },
        "daily": days,
        "daily_units": {
            "temperature": daily_units["temperature_2m_max"],
            "precipitation_probability": daily_units[
                "precipitation_probability_max"
            ],
        },
    }


def render_text(result):
    loc = result["location"]
    cur = result["current"]
    daily_units = result["daily_units"]
    lines = []

    lines.append(f"{loc['label']} — {cur['time'].replace('T', ' ')} ({loc['timezone']})")
    lines.append("")
    lines.append(
        f"Ahora: {cur['temperature']} {cur['temperature_unit']} "
        f"(sensación {cur['apparent_temperature']} {cur['temperature_unit']}) · "
        f"{cur['condition']}"
    )
    lines.append(
        f"Humedad {cur['humidity']}{cur['humidity_unit']} · "
        f"Viento {cur['wind_speed']} {cur['wind_speed_unit']} · "
        f"Precipitación {cur['precipitation']} {cur['precipitation_unit']}"
    )
    lines.append("")
    lines.append("Pronóstico")
    for day in result["daily"]:
        lines.append(
            "  {day_label}   {tmin} – {tmax} {tunit}   {cond:<20} lluvia {prob}{punit}".format(
                day_label=day["day_label"],
                tmin=day["temp_min"],
                tmax=day["temp_max"],
                tunit=daily_units["temperature"],
                cond=day["condition"],
                prob=day["precipitation_probability_max"],
                punit=daily_units["precipitation_probability"],
            )
        )

    return "\n".join(lines)


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser(
        description="Consulta el clima actual y el pronóstico de 3 días."
    )
    parser.add_argument(
        "ciudad",
        nargs="*",
        help="Ciudad a consultar. Si se omite, se usa tu ubicación por IP.",
    )
    parser.add_argument(
        "--json", action="store_true", help="Salida en formato JSON estructurado."
    )
    args = parser.parse_args()

    if args.ciudad:
        lat, lon, label = geocode(" ".join(args.ciudad))
    else:
        lat, lon, label = locate_by_ip()

    data = forecast(lat, lon)
    result = build_result(label, data)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(render_text(result))


if __name__ == "__main__":
    main()
