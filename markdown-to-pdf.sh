 pandoc verify-circuit.md \
  -o verify-circuit.pdf \
  --pdf-engine=tectonic \
  -V geometry:margin=8mm \
  -V geometry:includeheadfoot