# experiment-tracking

Track, analyze, and compare experiment results from autonomous experiments.

## Purpose

This skill helps you:
- View experiment results in a structured way
- Compare metrics across experiments
- Identify best-performing configurations
- Generate reports from experiment logs

## When to Use

- After running autonomous experiments
- When comparing different approaches
- For post-experiment analysis
- When preparing experiment reports

## Results Format

Experiments log results in `experiments/<name>/results.tsv`:

```
commit	metric	memory	status	description
a1b2c3d	0.992	4.2	keep	baseline
b2c3d4e	0.985	4.3	keep	add layer norm
c3d4e5f	1.001	4.2	discard	decrease width
```

## Commands

### View Results

```bash
# Pretty-print results table
clustershell experiment log <name>

# Show last N experiments
clustershell experiment log <name> --last 10

# Filter by status
clustershell experiment log <name> --status keep
```

### Compare Experiments

```bash
# Compare all experiments
clustershell experiment compare <name>

# Show top performers
clustershell experiment compare <name> --top 5

# Sort by specific metric
clustershell experiment compare <name> --sort metric --desc
```

### Generate Reports

```bash
# Markdown report
clustershell experiment report <name> --format markdown

# JSON for further processing
clustershell experiment report <name> --format json

# HTML report with charts
clustershell experiment report <name> --format html
```

## Analysis Queries

### Find Best Result

```bash
# Lowest metric (common for loss/error rates)
cat experiments/<name>/results.tsv | tail -n +2 | sort -t$'\t' -k2 -n | head -1

# Highest metric (common for accuracy/scores)
cat experiments/<name>/results.tsv | tail -n +2 | sort -t$'\t' -k2 -rn | head -1
```

### Success Rate

```bash
# Count by status
awk -F'\t' 'NR>1 {count[$4]++} END {for(s in count) print s, count[s]}' experiments/<name>/results.tsv
```

### Metric Distribution

```bash
# Basic stats
awk -F'\t' 'NR>1 {sum+=$2; sumsq+=$2*$2; count++} END {
  mean=sum/count
  std=sqrt(sumsq/count - mean*mean)
  print "Mean:", mean, "Std:", std
}' experiments/<name>/results.tsv
```

## Visualization

### Progress Over Time

Plot metric vs experiment number:

```python
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('experiments/<name>/results.tsv', sep='\t')
df['experiment'] = range(len(df))
df.plot(x='experiment', y='metric', kind='line')
plt.savefig('progress.png')
```

### Best Running Value

Track improvement over time:

```python
df['best_so_far'] = df['metric'].cummin()  # or cummax for maximize
df.plot(x='experiment', y='best_so_far', kind='line')
```

## Multi-Experiment Comparison

When running multiple experiment types:

```bash
experiments/
├── hyperparameter-search/
│   └── results.tsv
├── architecture-ablation/
│   └── results.tsv
└── optimizer-comparison/
    └── results.tsv
```

Compare across experiments:

```bash
for dir in experiments/*/; do
  name=$(basename "$dir")
  best=$(tail -n +2 "$dir/results.tsv" | sort -t$'\t' -k2 -n | head -1)
  echo -e "$name\t$best"
done
```

## Integration with Git

### Find Commit for Best Result

```bash
best_commit=$(tail -n +2 experiments/<name>/results.tsv | sort -t$'\t' -k2 -n | head -1 | cut -f1)
git show $best_commit
```

### Create Branch from Best Result

```bash
best_commit=$(tail -n +2 experiments/<name>/results.tsv | sort -t$'\t' -k2 -n | head -1 | cut -f1)
git checkout -b best-<name> $best_commit
```

### Cherry-Pick Good Changes

```bash
# Get all "keep" commits
awk -F'\t' '$4=="keep" {print $1}' experiments/<name>/results.tsv | while read commit; do
  git cherry-pick $commit
done
```

## Export Formats

### Markdown Table

```bash
echo "| Commit | Metric | Memory | Status | Description |"
echo "|--------|--------|--------|--------|-------------|"
tail -n +2 experiments/<name>/results.tsv | awk -F'\t' '{printf "| %s | %s | %s | %s | %s |\n", $1, $2, $3, $4, $5}'
```

### CSV (for spreadsheets)

```bash
cat experiments/<name>/results.tsv | tr '\t' ',' > results.csv
```

### JSON (for scripts)

```python
import csv, json
with open('experiments/<name>/results.tsv') as f:
  reader = csv.DictReader(f, delimiter='\t')
  print(json.dumps(list(reader), indent=2))
```

## Best Practices

1. **Always log experiments** - Even failures provide data
2. **Use descriptive messages** - Future you will thank present you
3. **Record all relevant metrics** - Not just the primary one
4. **Note resource usage** - Memory/time helps compare efficiency
5. **Keep program.md updated** - As you learn, update your experiment strategy

## See Also

- `autonomous-experiment` - Running autonomous experiment loops
- `generate-sandbox-policy` - Creating policies for experiments
