#!/usr/bin/env python3
"""把体检的「事实」和 DSH 的「分析」合并成一个 JSON，给前端渲染。

模型输出不一定严格是 JSON（可能包了 ```json 代码块，或前后带解释），
所以这里做容错提取；实在解析不出来就把原文当纯文本返回，前端照样能显示。
"""
import json
import os
import re
import sys


def extract_json(text: str):
    """从模型输出里抠出第一个完整的 JSON 对象。"""
    if not text:
        return None
    # 去掉 markdown 代码块围栏
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fenced:
        text = fenced.group(1)
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def main() -> int:
    tmp = sys.argv[1]
    with open(os.path.join(tmp, "facts.json"), encoding="utf-8") as fh:
        facts = json.load(fh)
    try:
        with open(os.path.join(tmp, "raw.txt"), encoding="utf-8") as fh:
            raw = fh.read()
    except OSError:
        raw = ""

    analysis = extract_json(raw)
    result = {
        "ok": True,
        "facts": facts,
        "analysis": analysis,
        # 解析失败时前端显示原文，至少能看到模型说了什么
        "analysis_raw": None if analysis else (raw.strip() or None),
    }
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
