import type { ComponentType, SVGProps } from "react";
import {
  ArrowsActionLoginBold,
  ArrowsActionLoginLinear,
} from "mx-icons/components/arrows-action-login";
import {
  ArrowsActionLogoutBold,
  ArrowsActionLogoutLinear,
} from "mx-icons/components/arrows-action-logout";
import { BuildingBold, BuildingLinear } from "mx-icons/components/building";
import { CalendarBold, CalendarLinear } from "mx-icons/components/calendar";
import {
  ClipboardBold,
  ClipboardLinear,
} from "mx-icons/components/clipboard";
import {
  DocumentTextBold,
  DocumentTextLinear,
} from "mx-icons/components/document-text";
import { MapBold, MapLinear } from "mx-icons/components/map";
import { MoneyBold, MoneyLinear } from "mx-icons/components/money";
import { MoonBold, MoonLinear } from "mx-icons/components/moon";
import { PeopleBold, PeopleLinear } from "mx-icons/components/people";
import { PlayBold, PlayLinear } from "mx-icons/components/play";
import { SunBold, SunLinear } from "mx-icons/components/sun";
import { UserBold, UserLinear } from "mx-icons/components/user";
import { UserPlusBold, UserPlusLinear } from "mx-icons/components/user-plus";
import {
  VolumeLoudBold,
  VolumeLoudLinear,
} from "mx-icons/components/volume-loud";
import { WalletBold, WalletLinear } from "mx-icons/components/wallet";

export type IconName =
  | "login"
  | "logout"
  | "play"
  | "guest"
  | "building"
  | "wallet"
  | "money"
  | "map"
  | "people"
  | "userPlus"
  | "megaphone"
  | "calendar"
  | "document"
  | "clipboard"
  | "moon"
  | "sun";

type Weight = "linear" | "bold";

type SvgIcon = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number | string }
>;

const ICONS: Record<IconName, Record<Weight, SvgIcon>> = {
  login: { linear: ArrowsActionLoginLinear, bold: ArrowsActionLoginBold },
  logout: { linear: ArrowsActionLogoutLinear, bold: ArrowsActionLogoutBold },
  play: { linear: PlayLinear, bold: PlayBold },
  guest: { linear: UserLinear, bold: UserBold },
  building: { linear: BuildingLinear, bold: BuildingBold },
  wallet: { linear: WalletLinear, bold: WalletBold },
  money: { linear: MoneyLinear, bold: MoneyBold },
  map: { linear: MapLinear, bold: MapBold },
  people: { linear: PeopleLinear, bold: PeopleBold },
  userPlus: { linear: UserPlusLinear, bold: UserPlusBold },
  megaphone: { linear: VolumeLoudLinear, bold: VolumeLoudBold },
  calendar: { linear: CalendarLinear, bold: CalendarBold },
  document: { linear: DocumentTextLinear, bold: DocumentTextBold },
  clipboard: { linear: ClipboardLinear, bold: ClipboardBold },
  moon: { linear: MoonLinear, bold: MoonBold },
  sun: { linear: SunLinear, bold: SunBold },
};

type Props = {
  name: IconName;
  weight?: Weight;
  size?: number;
  className?: string;
};

export function Icon({
  name,
  weight = "linear",
  size = 20,
  className,
}: Props) {
  const Glyph = ICONS[name][weight];
  return (
    <Glyph size={size} color="currentColor" className={className} aria-hidden />
  );
}
