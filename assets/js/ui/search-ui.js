import { getApartmentResidentName, normalizeText, uniqueBy } from "../utils/helpers.js";

export function searchApartments(term, data) {
  const normalized = normalizeText(term);
  if (!normalized) {
    return [];
  }

  const apartmentMatches = data.apartments
    .filter((item) => !item.isArchived)
    .filter((item) =>
      normalizeText([item.apartmentNumber, getApartmentResidentName(item), item.phone].join(" ")).includes(normalized),
    )
    .map((item) => ({
      apartmentId: item.id,
      title: `شقة ${item.apartmentNumber}`,
      subtitle: getApartmentResidentName(item) || "-",
    }));

  const residentMatches = data.residents
    .filter((resident) =>
      normalizeText([resident.name, resident.whatsapp, resident.carNumber].join(" ")).includes(normalized),
    )
    .map((resident) => {
      const apartment = data.apartments.find((item) => item.id === resident.apartmentId);
      if (!apartment || apartment.isArchived) {
        return null;
      }

      return {
        apartmentId: apartment.id,
        title: `شقة ${apartment.apartmentNumber}`,
        subtitle: `الساكن: ${resident.name}`,
      };
    })
    .filter(Boolean);

  return uniqueBy([...apartmentMatches, ...residentMatches], (item) => item.apartmentId).slice(0, 8);
}

export function renderSearchResults(items) {
  return items
    .map(
      (item) => `
        <button type="button" class="search-result w-100 border-0 bg-transparent text-end" data-action="search-open-apartment" data-id="${item.apartmentId}">
          <div>
            <strong>${item.title}</strong>
            <div class="small text-muted">${item.subtitle}</div>
          </div>
          <i class="fa-solid fa-arrow-left"></i>
        </button>
      `,
    )
    .join("");
}
