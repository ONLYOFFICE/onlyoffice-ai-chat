import { Button } from "../../components/button";
import { Checkbox } from "../../components/checkbox";
import { ComboBox } from "../../components/combo-box";
import {
  DialogContent,
  DialogFooter,
  DialogOverlay,
} from "../../components/dialog";
import { DropDownItem } from "../../components/dropdown-item";
import { DropdownMenu } from "../../components/dropdown";
import { FieldContainer } from "../../components/field-container";
import { IconButton } from "../../components/icon-button";
import { Input } from "../../components/input";
import { Link } from "../../components/link";
import { Loader } from "../../components/loader";
import { RadioButton } from "../../components/radio-button";
import { Tabs } from "../../components/tabs";
import { TooltipContent } from "../../components/tooltip";
import { TooltipIconButton } from "../../components/tooltip-icon-button";
import { ToggleButton } from "../../components/toggle-button";
import type { ComponentOverrides } from "./types";

export const defaultComponents: Required<ComponentOverrides> = {
  Button,
  IconButton,
  Input,
  Checkbox,
  RadioButton,
  ToggleButton,
  ComboBox,
  DialogContent,
  DialogOverlay,
  DialogFooter,
  DropdownMenu,
  DropDownItem,
  Tabs,
  TooltipContent,
  TooltipIconButton,
  Link,
  Loader,
  FieldContainer,
};
