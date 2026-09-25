#!/usr/bin/env python3
"""Kjører en kommando i en pseudo-terminal og svarer Enter (standardvalget) på spørsmål.

eas-cli lager bare nye Apple-sertifikater i interaktiv modus. I GitHub Actions finnes det
ingen terminal, så dette skriptet later som det er en: det viser all utdata og trykker
Enter når eas-cli stiller et spørsmål (linjer som starter med «?» og inneholder «›»).

Bruk: python3 scripts/answer-prompts.py npx eas-cli build --platform ios ...
"""
import os
import pty
import re
import select
import sys
import time

MAX_ANSWERS = 40
PROMPT = re.compile(r"(?:^|\n|\r)\s*\?\s[^\n]*›")
ANSI = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")


def main() -> int:
    cmd = sys.argv[1:]
    if not cmd:
        print(__doc__)
        return 2
    env = dict(os.environ)
    env.pop("CI", None)  # ellers tvinger eas-cli ikke-interaktiv modus
    env.setdefault("TERM", "xterm-256color")

    pid, fd = pty.fork()
    if pid == 0:
        os.execvpe(cmd[0], cmd, env)

    answers = 0
    last_answer = 0.0
    tail = ""
    while True:
        try:
            ready, _, _ = select.select([fd], [], [], 1.0)
        except InterruptedError:
            continue
        if ready:
            try:
                data = os.read(fd, 4096)
            except OSError:
                break  # barneprosessen er ferdig
            if not data:
                break
            sys.stdout.buffer.write(data)
            sys.stdout.flush()
            tail = (tail + ANSI.sub("", data.decode("utf-8", "replace")))[-600:]
        # Svar når et spørsmål står åpent og det har vært stille litt.
        if PROMPT.search(tail) and time.time() - last_answer > 2.0:
            if answers >= MAX_ANSWERS:
                print("\n[answer-prompts] For mange spørsmål – avbryter.", flush=True)
                os.kill(pid, 15)
                break
            time.sleep(0.5)
            os.write(fd, b"\r")
            answers += 1
            last_answer = time.time()
            tail = ""
            print(f"\n[answer-prompts] Svarte med standardvalg (#{answers})", flush=True)

    _, status = os.waitpid(pid, 0)
    return os.waitstatus_to_exitcode(status)


if __name__ == "__main__":
    sys.exit(main())
