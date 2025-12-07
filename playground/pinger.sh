for i in {3..20}; do
  if ping -c 1 -W 1 10.0.0.$i &> /dev/null; then
    echo "10.0.0.$i is ONLINE"
  fi
done
