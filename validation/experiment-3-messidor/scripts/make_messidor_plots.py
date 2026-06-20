#!/usr/bin/env python3
"""Figuras del experimento Messidor (300 dpi). Lee los results/ ya generados."""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

BASE = Path(__file__).parent.parent
RES = BASE / "results"


def save(fig, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  -> {path.relative_to(BASE)}")


def plot_roc() -> None:
    roc_p = RES / "01-binary" / "roc_curve.json"
    m_p = RES / "01-binary" / "metrics.json"
    if not roc_p.exists():
        return
    roc = json.load(open(roc_p))
    auc = json.load(open(m_p))["metrics"]["auc_roc"]
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.plot(roc["fpr"], roc["tpr"], lw=2, label=f"DIRD+ v2 (AUC={auc:.3f})")
    ax.plot([0, 1], [0, 1], "--", color="gray", lw=1)
    ax.set(xlabel="1 - especificidad (FPR)", ylabel="sensibilidad (TPR)",
           title="Messidor OOD — ROC (libre de umbral)")
    ax.legend(loc="lower right")
    save(fig, RES / "plots" / "01_roc_ood.png")


def plot_tau_gap() -> None:
    p = RES / "03-frozen-tau" / "frozen_tau.json"
    if not p.exists():
        return
    d = json.load(open(p))
    frozen, refit = d["tau_frozen_from_aptos_fpr02"], d["tau_refit_on_messidor_fpr02"]
    classes = list(frozen.keys())
    x = np.arange(len(classes))
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar(x - 0.2, [frozen[c] for c in classes], 0.4, label="τ congelado (APTOS)")
    ax.bar(x + 0.2, [refit[c] for c in classes], 0.4, label="τ recalibrado (Messidor)")
    ax.set_xticks(x)
    ax.set_xticklabels(classes, rotation=20, ha="right")
    ax.set(ylabel="umbral τ", title="τ congelado vs recalibrado (FPR=2%)")
    ax.legend()
    save(fig, RES / "plots" / "02_tau_frozen_vs_refit.png")


def plot_rules() -> None:
    p = RES / "03-frozen-tau" / "rules_summary.csv"
    if not p.exists():
        return
    df = pd.read_csv(p, index_col=0)
    metrics = ["sensitivity", "specificity", "mcc"]
    x = np.arange(len(df.index))
    fig, ax = plt.subplots(figsize=(8, 4.5))
    for i, mname in enumerate(metrics):
        ax.bar(x + (i - 1) * 0.25, df[mname], 0.25, label=mname)
    ax.set_xticks(x)
    ax.set_xticklabels(df.index, rotation=20, ha="right")
    ax.set(ylim=(0, 1.05), title="Reglas sobre Messidor (frozen vs refit)")
    ax.legend()
    save(fig, RES / "plots" / "03_rules_comparison.png")


def main() -> None:
    print("[*] Generando figuras Messidor...")
    plot_roc()
    plot_tau_gap()
    plot_rules()
    print("[OK]")


if __name__ == "__main__":
    main()
