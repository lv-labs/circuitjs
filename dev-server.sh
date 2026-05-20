#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$DIR/.gradle-home}"

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

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js not found."
    echo "Install Node.js before running this script."
    exit 1
fi

cd "$DIR"
exec node scripts/dev-server.mjs
