---
name: clima
description: >
  Consulta el clima actual y el pronóstico de 3 días para tu ubicación (detectada por IP)
  o para una ciudad concreta. Úsala cuando el usuario pregunte por "clima", "tiempo",
  "temperatura", "va a llover", "pronóstico", "weather", o invoque /clima [ciudad].
---

Esta skill obtiene el clima ejecutando `scripts/weather.py`, que usa APIs públicas
(ipinfo.io para geolocalización por IP, Open-Meteo para geocodificación y pronóstico)
sin necesidad de API key.

## Uso

Sin argumentos, usa tu ubicación actual (detectada por IP):

```bash
python .claude/skills/clima/scripts/weather.py
```

Con una ciudad concreta:

```bash
python .claude/skills/clima/scripts/weather.py Madrid
python .claude/skills/clima/scripts/weather.py "Buenos Aires"
```

**Nota de shell**: en PowerShell usa `python`; en Git Bash usa `python3`.

Para obtener el resultado como JSON estructurado (útil si necesitas encadenar el dato
con otra herramienta en lugar de mostrarlo en pantalla), añade `--json`:

```bash
python .claude/skills/clima/scripts/weather.py --json
python .claude/skills/clima/scripts/weather.py Madrid --json
```

## Regla de respuesta

Ejecuta el script y devuelve su salida al usuario tal cual, o resúmela en una o dos
líneas si el usuario solo pidió un dato puntual (p. ej. "¿hace frío?"). No reescribas
ni inventes cifras, y no vuelvas a consultar las APIs por otro medio (curl, WebFetch, etc.).

## Errores

Si el script termina con código de salida distinto de 0, muestra el mensaje de error
tal cual (suele ser falta de conexión o una ciudad que no se encontró) y no reintentes
más de una vez.
