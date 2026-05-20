#!/usr/bin/env bash
set -euo pipefail

PORT=${1:-8000}
DIR="$(cd "$(dirname "$0")" && pwd)"

# Prefer a repo-local Gradle cache so local builds work even in restricted
# environments and don't depend on machine-wide Gradle state.
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$DIR/.gradle-home}"

# On macOS, auto-select Java 8 for this older GWT toolchain when JAVA_HOME
# hasn't been set by the user already.
if [[ -z "${JAVA_HOME:-}" ]] && [[ "$(uname -s)" == "Darwin" ]] && command -v /usr/libexec/java_home >/dev/null 2>&1; then
    if JAVA8_HOME="$(/usr/libexec/java_home -v 1.8 2>/dev/null)"; then
        export JAVA_HOME="$JAVA8_HOME"
        export PATH="$JAVA_HOME/bin:$PATH"
    fi
fi

if ! command -v java >/dev/null 2>&1; then
    echo "Java not found."
    echo "Install Java 8 and/or set JAVA_HOME before running this script."
    exit 1
fi

# Find Gradle — prefer wrapper, then local install, then /tmp
if [ -x "$DIR/gradlew" ]; then
    GRADLE="$DIR/gradlew"
elif [ -x /tmp/gradle-8.7/bin/gradle ]; then
    GRADLE=/tmp/gradle-8.7/bin/gradle
elif command -v gradle &>/dev/null; then
    GRADLE=gradle
else
    echo "Gradle not found. Install it or download 8.7:"
    echo "  curl -sL https://services.gradle.org/distributions/gradle-8.7-bin.zip -o /tmp/g.zip && unzip -qo /tmp/g.zip -d /tmp"
    exit 1
fi

echo "=== Using: $GRADLE ==="
echo "=== GRADLE_USER_HOME: $GRADLE_USER_HOME ==="
if [[ -n "${JAVA_HOME:-}" ]]; then
    echo "=== JAVA_HOME: $JAVA_HOME ==="
fi

echo "=== Compiling GWT ==="
cd "$DIR"
$GRADLE compileGwt makeSite --console verbose

echo ""
echo "=== Starting server on http://localhost:$PORT/circuitjs.html ==="
cd "$DIR/site"
open "http://localhost:$PORT/circuitjs.html" 2>/dev/null \
  || xdg-open "http://localhost:$PORT/circuitjs.html" 2>/dev/null \
  || echo "Open http://localhost:$PORT/circuitjs.html in your browser"
python3 -m http.server "$PORT"
