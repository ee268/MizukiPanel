import LanguageOutlined from "@mui/icons-material/LanguageOutlined";
import WallpaperOutlined from "@mui/icons-material/WallpaperOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import ExploreOutlined from "@mui/icons-material/ExploreOutlined";
import ViewSidebarOutlined from "@mui/icons-material/ViewSidebarOutlined";
import VerticalAlignBottomOutlined from "@mui/icons-material/VerticalAlignBottomOutlined";
import ForumOutlined from "@mui/icons-material/ForumOutlined";
import ShareOutlined from "@mui/icons-material/ShareOutlined";
import CampaignOutlined from "@mui/icons-material/CampaignOutlined";
import MusicNoteOutlined from "@mui/icons-material/MusicNoteOutlined";
import LibraryBooksOutlined from "@mui/icons-material/LibraryBooksOutlined";
import ShuffleOutlined from "@mui/icons-material/ShuffleOutlined";
import GavelOutlined from "@mui/icons-material/GavelOutlined";
import LinkOutlined from "@mui/icons-material/LinkOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import CodeOutlined from "@mui/icons-material/CodeOutlined";
import LocalFloristOutlined from "@mui/icons-material/LocalFloristOutlined";
import FaceOutlined from "@mui/icons-material/FaceOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";

const icons = {
  siteConfig: LanguageOutlined,
  fullscreenWallpaperConfig: WallpaperOutlined,
  profileConfig: PersonOutlined,
  navBarConfig: ExploreOutlined,
  sidebarLayoutConfig: ViewSidebarOutlined,
  footerConfig: VerticalAlignBottomOutlined,
  commentConfig: ForumOutlined,
  shareConfig: ShareOutlined,
  announcementConfig: CampaignOutlined,
  musicPlayerConfig: MusicNoteOutlined,
  relatedPostsConfig: LibraryBooksOutlined,
  randomPostsConfig: ShuffleOutlined,
  licenseConfig: GavelOutlined,
  permalinkConfig: LinkOutlined,
  markdownConfig: DescriptionOutlined,
  expressiveCodeConfig: CodeOutlined,
  sakuraConfig: LocalFloristOutlined,
  pioConfig: FaceOutlined,
};
export function ConfigIcon({ configKey }: { configKey: string }) {
  const Icon = icons[configKey as keyof typeof icons] ?? TuneOutlined;
  return <Icon sx={{ fontSize: 30 }} />;
}
