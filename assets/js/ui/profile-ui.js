export const AVATAR_PRESETS = [
  {
    id: "classic-lilac",
    label: "بنفسجي",
    icon: "fa-solid fa-user",
    className: "user-avatar--lilac",
  },
  {
    id: "emerald-green",
    label: "أخضر زمردي",
    icon: "fa-solid fa-user",
    className: "user-avatar--green",
  },
  {
    id: "royal-blue",
    label: "أزرق ملكي",
    icon: "fa-solid fa-user",
    className: "user-avatar--blue",
  },
  {
    id: "charcoal-dark",
    label: "رمادي فحمي",
    icon: "fa-solid fa-user",
    className: "user-avatar--dark",
  },
  {
    id: "sun-gold",
    label: "ذهبي",
    icon: "fa-solid fa-user",
    className: "user-avatar--gold",
  },
  {
    id: "coral-rose",
    label: "وردي مرجاني",
    icon: "fa-solid fa-user",
    className: "user-avatar--rose",
  },
];

export function getDefaultAvatarPresetId() {
  return "classic-lilac";
}

export function getRandomAvatarPresetId() {
  const randomIndex = Math.floor(Math.random() * AVATAR_PRESETS.length);
  return AVATAR_PRESETS[randomIndex]?.id || getDefaultAvatarPresetId();
}

export function getAvatarPresetById(presetId, role) {
  return AVATAR_PRESETS.find((item) => item.id === presetId) || AVATAR_PRESETS.find((item) => item.id === getDefaultAvatarPresetId(role)) || AVATAR_PRESETS[0];
}

export function getAvatarSettingsForm(selectedPresetId) {
  return `
    <form id="avatar-preferences-form">
      <div class="avatar-settings__intro">
        <p class="mb-0 text-muted">اختر الشكل واللون المناسبين لأيقونة حسابك. هذا التغيير يظهر على جهازك فقط.</p>
      </div>

      <div class="avatar-options-grid">
        ${AVATAR_PRESETS.map(
          (preset) => `
            <label class="avatar-option ${selectedPresetId === preset.id ? "avatar-option--active" : ""}">
              <input class="avatar-option__input" type="radio" name="avatarPreset" value="${preset.id}" ${selectedPresetId === preset.id ? "checked" : ""} />
              <span class="avatar-option__preview user-avatar ${preset.className}">
                <i class="${preset.icon}"></i>
              </span>
              <span class="avatar-option__label">${preset.label}</span>
            </label>
          `,
        ).join("")}
      </div>

      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" data-bs-dismiss="modal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ الاختيار</button>
      </div>
    </form>
  `;
}
