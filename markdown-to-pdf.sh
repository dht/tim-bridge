 pandoc md-input.md \
  -o md-output.pdf \
  --pdf-engine=tectonic \
  -V geometry:margin=8mm \
  -V geometry:includeheadfoot