"""Rent a phone number and attach it to a crew agent.

Usage:
    uv run provision.py --country IN --provider plivo
    uv run provision.py --country US --provider twilio --area-code 415

Reads SMALLEST_API_KEY and ATOMS_AGENT_ID from env / .env. Prints the
rented number + product ID at the end so you can dial it (inbound) or
pass it to outbound.py.
"""

import argparse
import os
import sys

from smallestai import SmallestAI


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country", required=True, help="ISO 3166-1 alpha-2 (IN, US, GB, ...)")
    parser.add_argument("--provider", required=True, choices=["plivo", "twilio"])
    parser.add_argument("--area-code", default=None, help="Optional area/region filter (provider-dependent)")
    args = parser.parse_args()

    agent_id = os.environ.get("ATOMS_AGENT_ID")
    if not agent_id:
        sys.exit("Set ATOMS_AGENT_ID in your env (or .env).")

    client = SmallestAI()  # reads SMALLEST_API_KEY

    # 1. Search inventory.
    search = client.atoms.phone_numbers.search_rentable(
        country_code=args.country,
        provider=args.provider,
        area_code=args.area_code,
    )
    candidates = search.data
    if not candidates:
        sys.exit(
            f"No {args.provider} numbers available for {args.country}"
            + (f" (area {args.area_code})" if args.area_code else "")
            + ". Try the other provider or drop the area-code filter."
        )

    target = candidates[0].phone_number
    print(f"Renting {target} from {args.provider} ...")

    # 2. Rent it. The rent response doesn't carry the product id, so look
    # it up in the account's numbers afterwards.
    client.atoms.phone_numbers.rent(
        phone_number=target,
        provider=args.provider,
    )
    product_id = next(
        n.id for n in client.atoms.phone_numbers.list().data
        if n.attributes.phone_number == target
    )

    # 3. Attach to the agent and enable inbound.
    client.atoms.agents.update_agent(
        id=agent_id,
        telephony_product_id=[product_id],
        allow_inbound_call=True,
    )

    print()
    print("Done.")
    print(f"  Rented number: {target}")
    print(f"  Product ID:    {product_id}")
    print(f"  Attached to:   {agent_id}  (allow_inbound_call=True)")
    print()
    print("Next steps:")
    print(f"  Inbound:  dial {target} from any phone.")
    print(f"  Outbound: uv run outbound.py --to <+E164> --from-product-id {product_id}")


if __name__ == "__main__":
    main()
