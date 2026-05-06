#!/bin/bash
python validate_idrid.py --model detection-v1.0.1.onnx --dataset datasets/idrid/full --output results/idrid-full --classes-json detection-metadata.json --benchmark --conf-threshold 0.1 --iou-threshold 0.1
