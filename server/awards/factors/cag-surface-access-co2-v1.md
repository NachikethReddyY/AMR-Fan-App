# CAG surface-access CO2 estimate, version 1

Technical scope accepted on 26 September 2026: ordinary Singapore journeys,
compared with a neutral single-occupant car using the published CAG FY2023/24
surface-access table. This is a CO2 estimate, not measured savings, a verified
transport mode, an offset, a Singapore fleet average or a lifecycle inventory.
Approval of these factors does not validate phone GPS or release physical awards.

## Sources and discrepancy

[CAG FY2023/24 sustainability report](https://www.changiairport.com/content/dam/changiairport/common/pdf/publications/2024/rediscovering-the-magic-of-travel.pdf),
PDF pages 90–92 (printed pages 88–90), states a CO2 focus and reports surface-access
factors of 0.1901 for cars per vehicle-km, 0.0441 for buses per passenger-km and
0.0578 for MRT per passenger-km. The table labels these **kg CO2e**. That published
label is retained in each provenance row as `publishedUnit`; it is not adopted
as proof of complete greenhouse-gas coverage.

[EPA 2024 GHG Emission Factors Hub](https://www.epa.gov/system/files/documents/2024-02/ghg-emission-factors-hub-2024.pdf),
Table 10, PDF page 6, lists CO2 factors of 0.306 kg/vehicle-mile for passenger cars,
0.071 kg/passenger-mile for buses and 0.093 kg/passenger-mile for transit rail.
Dividing by 1.609344 and rounding to four decimal places exactly matches all three
CAG numbers. EPA lists nonzero CH4 and N2O separately. This numeric comparison,
together with CAG's CO2-focused methodology, supports the narrower CO2 estimate.
CAG cites several source datasets without mapping every table row to one source;
the numeric match is an inference, not a documented row-level attribution.
There is no additional gas conversion or uplift. No ICE-only claim is made.

Car uses one occupant, so its vehicle-km value is numerically equal to the
single traveller's passenger-km value. Bus and MRT retain the published
passenger-km factors with no invented occupancy adjustment. Their underlying
fleet, occupancy and operating conditions need not represent an individual
Singapore vehicle or current Singapore fleet. Using this coherent published
table for ordinary Singapore travel is the accepted estimation convention.

Walking and cycling use zero motorized operational journey energy, consistent
with the [LTA Land Transport Master Plan 2013](https://www.lta.gov.sg/content/dam/ltagov/who_we_are/statistics_and_publications/master-plans/pdf/LTMP2013Report.pdf)
travel-mode comparison. This excludes food, bicycle manufacture, infrastructure
and all other lifecycle emissions. Zero does not mean zero total footprint.
Cab, electric car and unclassified transit remain unsupported.

## Retention and release boundary

The JSON configuration binds this note's SHA-256 and the exact factor array.
The application retains the version, units, source labels and assumptions at
Start. A hash proves which evidence was retained, not scientific calibration.
The `published_surface_access` / `single_occupant_car` CO2 basis is separate from
legacy `use_phase_co2e` / `single_occupant_ice` releases and stored CO2e receipts.

Provisional points use the retained planned estimate only after recorded start
and arrival checks pass. They are labelled provisional and excluded from
verified impact. Full assessed calculations remain separate. Physical release
still requires actual field evidence for its retained assessment policy.

Written by gpt-6-astra through Codex (T3 Code).
