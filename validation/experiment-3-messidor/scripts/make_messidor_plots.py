#!/usr/bin/env python3
"""Figuras del experimento Messidor (300 dpi). Lee solo archivos versionados de results/
(per_image.csv, 03-frozen-tau/*, metrics.json, roc_curve.json) — no depende del dump
raw_detections.csv (gitignored)."""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, roc_curve

BASE = Path(__file__).parent.parent
RES = BASE / "results"
PLOTS = RES / "plots"
LESION = ["hard_exudate", "hemorrhage", "cotton_wool_spot", "microhemorrhages"]

# Ancla in-distribution APTOS (REPORT exp-2) para las comparativas cross-dataset.
APTOS = {"auc": 0.96, "sensitivity": 0.978, "specificity": 0.931, "mcc": 0.911}


def save(fig, name: str) -> None:
    PLOTS.mkdir(parents=True, exist_ok=True)
    fig.savefig(PLOTS / name, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  -> {(PLOTS / name).relative_to(BASE)}")


def _load():
    d = {}
    p = RES / "01-binary" / "per_image.csv"
    d["per_image"] = pd.read_csv(p) if p.exists() else None
    p = RES / "01-binary" / "metrics.json"
    d["metrics"] = json.load(open(p)) if p.exists() else None
    p = RES / "01-binary" / "roc_curve.json"
    d["roc"] = json.load(open(p)) if p.exists() else None
    p = RES / "03-frozen-tau" / "per_image_class_scores.csv"
    d["pcs"] = pd.read_csv(p, index_col=0) if p.exists() else None
    p = RES / "03-frozen-tau" / "rules_summary.csv"
    d["rules"] = pd.read_csv(p, index_col=0) if p.exists() else None
    p = RES / "03-frozen-tau" / "frozen_tau.json"
    d["ft"] = json.load(open(p)) if p.exists() else None
    return d


def plot_roc_ood(d) -> None:
    if not d["roc"] or not d["metrics"]:
        return
    auc = d["metrics"]["metrics"]["auc_roc"]
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.plot(d["roc"]["fpr"], d["roc"]["tpr"], lw=2, label=f"DIRD+ v2 (AUC={auc:.3f})")
    ax.plot([0, 1], [0, 1], "--", color="gray", lw=1)
    ax.set(xlabel="1 - especificidad (FPR)", ylabel="sensibilidad (TPR)",
           title="Messidor OOD — ROC binaria (libre de umbral)")
    ax.legend(loc="lower right")
    save(fig, "01_roc_ood.png")


def plot_roc_per_class(d) -> None:
    if d["pcs"] is None:
        return
    y = d["pcs"]["gt_binary"].values
    fig, ax = plt.subplots(figsize=(5.5, 5.5))
    for c in LESION:
        if c not in d["pcs"]:
            continue
        s = d["pcs"][c].values
        try:
            auc = roc_auc_score(y, s)
            fpr, tpr, _ = roc_curve(y, s)
            ax.plot(fpr, tpr, lw=1.6, label=f"{c} ({auc:.3f})")
        except Exception:  # noqa: BLE001
            pass
    ax.plot([0, 1], [0, 1], "--", color="gray", lw=1)
    ax.set(xlabel="FPR", ylabel="TPR", title="Messidor — ROC por clase de lesión")
    ax.legend(loc="lower right", fontsize=8)
    save(fig, "02_roc_per_class.png")


def plot_score_dist_binary(d) -> None:
    pi = d["per_image"]
    if pi is None or "max_lesion_score" not in pi:
        return
    fig, ax = plt.subplots(figsize=(6.5, 4))
    bins = np.linspace(0, 1, 31)
    ax.hist(pi[pi.gt_binary == 0]["max_lesion_score"], bins=bins, alpha=0.6,
            label="normal", color="#2c7fb8", density=True)
    ax.hist(pi[pi.gt_binary == 1]["max_lesion_score"], bins=bins, alpha=0.6,
            label="patológica", color="#de2d26", density=True)
    ax.set(xlabel="max lesion score @conf 0.25", ylabel="densidad",
           title="Messidor — distribución de score binario")
    ax.legend()
    save(fig, "03_score_dist_binary.png")


def plot_score_dist_per_class(d) -> None:
    if d["pcs"] is None or d["ft"] is None:
        return
    y = d["pcs"]["gt_binary"].values
    tau = d["ft"]["tau_frozen_from_aptos_fpr02"]
    fig, axes = plt.subplots(2, 2, figsize=(10, 7))
    bins = np.linspace(0, 1, 31)
    for ax, c in zip(axes.ravel(), LESION):
        if c not in d["pcs"]:
            ax.axis("off"); continue
        s = d["pcs"][c].values
        ax.hist(s[y == 0], bins=bins, alpha=0.6, label="normal", color="#2c7fb8", density=True)
        ax.hist(s[y == 1], bins=bins, alpha=0.6, label="patol.", color="#de2d26", density=True)
        if c in tau:
            ax.axvline(tau[c], color="k", ls="--", lw=1.2, label=f"τ={tau[c]:.2f}")
        ax.set(title=c, yscale="log")
        ax.legend(fontsize=7)
    fig.suptitle("Messidor — score por clase (normal vs patológica) con τ congelado")
    fig.tight_layout()
    save(fig, "04_score_dist_per_class.png")


def plot_per_grade(d) -> None:
    pi = d["per_image"]
    if pi is None or "gt_grade" not in pi:
        return
    grades = sorted(pi["gt_grade"].unique())
    rate, ns = [], []
    for g in grades:
        sub = pi[pi.gt_grade == g]
        ns.append(len(sub))
        # grado 0: bien clasificado = pred 0 (especificidad); grados>0: detectado = pred 1
        rate.append((sub.pred_binary == (0 if g == 0 else 1)).mean())
    fig, ax = plt.subplots(figsize=(6.5, 4))
    colors = ["#2c7fb8" if g == 0 else "#de2d26" for g in grades]
    bars = ax.bar([str(g) for g in grades], rate, color=colors)
    for b, n in zip(bars, ns):
        ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 0.01, f"n={n}",
                ha="center", fontsize=8)
    ax.set(ylim=(0, 1.08), xlabel="grado ICDR",
           ylabel="acierto (g0=especificidad, g≥1=sensibilidad)",
           title="Messidor — acierto por grado de severidad")
    save(fig, "05_per_grade_detection.png")


def _cm_ax(ax, tn, fp, fn, tp, title):
    cm = np.array([[tn, fp], [fn, tp]])
    ax.imshow(cm, cmap="Blues")
    for i in range(2):
        for j in range(2):
            ax.text(j, i, int(cm[i, j]), ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=12)
    ax.set(xticks=[0, 1], yticks=[0, 1], xticklabels=["norm", "alt"],
           yticklabels=["norm", "alt"], xlabel="pred", ylabel="GT", title=title)


def plot_confusions(d) -> None:
    if d["metrics"] is None or d["rules"] is None:
        return
    cm = d["metrics"]["confusion_matrix"]
    fig, axes = plt.subplots(1, 3, figsize=(12, 4))
    _cm_ax(axes[0], cm["TN"], cm["FP"], cm["FN"], cm["TP"], "baseline any-lesion @0.25")
    for ax, rule in zip(axes[1:], ["FROZEN_fpr02", "REFIT_fpr02"]):
        if rule in d["rules"].index:
            r = d["rules"].loc[rule]
            _cm_ax(ax, int(r.TN), int(r.FP), int(r.FN), int(r.TP), rule)
        else:
            ax.axis("off")
    fig.suptitle("Messidor — matrices de confusión")
    fig.tight_layout()
    save(fig, "06_confusion_matrices.png")


def plot_tau_gap(d) -> None:
    if d["ft"] is None:
        return
    frozen, refit = d["ft"]["tau_frozen_from_aptos_fpr02"], d["ft"]["tau_refit_on_messidor_fpr02"]
    classes = list(frozen.keys())
    x = np.arange(len(classes))
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar(x - 0.2, [frozen[c] for c in classes], 0.4, label="τ congelado (APTOS)")
    ax.bar(x + 0.2, [refit[c] for c in classes], 0.4, label="τ recalibrado (Messidor)")
    ax.set_xticks(x); ax.set_xticklabels(classes, rotation=20, ha="right")
    ax.set(ylabel="umbral τ", title="τ congelado vs recalibrado (FPR=2%)")
    ax.legend()
    save(fig, "07_tau_frozen_vs_refit.png")


def plot_rules(d) -> None:
    if d["rules"] is None:
        return
    df = d["rules"]
    metrics = ["sensitivity", "specificity", "mcc"]
    x = np.arange(len(df.index))
    fig, ax = plt.subplots(figsize=(8, 4.5))
    for i, m in enumerate(metrics):
        ax.bar(x + (i - 1) * 0.25, df[m], 0.25, label=m)
    ax.set_xticks(x); ax.set_xticklabels(df.index, rotation=20, ha="right")
    ax.set(ylim=(0, 1.05), title="Messidor — reglas (frozen vs refit)")
    ax.legend()
    save(fig, "08_rules_comparison.png")


def plot_sens_spec_scatter(d) -> None:
    if d["rules"] is None:
        return
    df = d["rules"]
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.scatter(df["specificity"], df["sensitivity"], s=60, color="#de2d26", zorder=3)
    for name, r in df.iterrows():
        ax.annotate(name, (r.specificity, r.sensitivity), fontsize=7,
                    xytext=(4, 4), textcoords="offset points")
    ax.scatter([APTOS["specificity"]], [APTOS["sensitivity"]], s=90, marker="*",
               color="#2c7fb8", zorder=3, label="APTOS PCT_fpr02 (in-dist)")
    ax.set(xlim=(0.5, 1.02), ylim=(0.2, 1.02), xlabel="especificidad",
           ylabel="sensibilidad", title="Messidor — sens/spec por regla")
    ax.legend(loc="lower left", fontsize=8)
    save(fig, "09_rules_sens_spec_scatter.png")


def plot_cross_dataset(d) -> None:
    if d["ft"] is None or d["rules"] is None or "FROZEN_fpr02" not in d["rules"].index:
        return
    r = d["rules"].loc["FROZEN_fpr02"]
    mess = {"auc": d["ft"].get("auc_ood_threshold_free"), "sensitivity": r.sensitivity,
            "specificity": r.specificity, "mcc": r.mcc}
    labels = ["AUC", "sens", "spec", "MCC"]
    keys = ["auc", "sensitivity", "specificity", "mcc"]
    x = np.arange(len(labels))
    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.bar(x - 0.2, [APTOS[k] for k in keys], 0.4, label="APTOS (in-dist, CV)", color="#2c7fb8")
    ax.bar(x + 0.2, [mess[k] for k in keys], 0.4, label="Messidor (frozen-τ)", color="#de2d26")
    for i, k in enumerate(keys):
        ax.text(i - 0.2, APTOS[k] + 0.01, f"{APTOS[k]:.2f}", ha="center", fontsize=8)
        if mess[k] is not None:
            ax.text(i + 0.2, mess[k] + 0.01, f"{mess[k]:.2f}", ha="center", fontsize=8)
    ax.set_xticks(x); ax.set_xticklabels(labels)
    ax.set(ylim=(0, 1.08), title="APTOS (in-dist) vs Messidor (OOD frozen-τ)\n⚠ Messidor = mirror preprocesado")
    ax.legend()
    save(fig, "10_aptos_vs_messidor.png")


def main() -> None:
    print("[*] Generando figuras Messidor...")
    d = _load()
    for fn in (plot_roc_ood, plot_roc_per_class, plot_score_dist_binary,
               plot_score_dist_per_class, plot_per_grade, plot_confusions,
               plot_tau_gap, plot_rules, plot_sens_spec_scatter, plot_cross_dataset):
        try:
            fn(d)
        except Exception as e:  # noqa: BLE001
            print(f"  [skip] {fn.__name__}: {e}")
    print("[OK]")


if __name__ == "__main__":
    main()
