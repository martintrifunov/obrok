import { useState, useMemo } from "react";
import { Marker, Popup } from "react-map-gl/maplibre";
import { Typography, Box, styled } from "@mui/material";
import creditPopupIcon from "@/assets/icons/credit_popup.svg";
import useMapPitch from "@/features/map/hooks/useMapPitch";
import {
  CREDIT_MARKER_PATH,
  MARKER_VIEWBOX,
} from "@/features/map/config/markerPaths";

const CreditMarker = () => {
  const [showPopup, setShowPopup] = useState(false);
  const pitch = useMapPitch();
  const position = { lng: 21.409471852749466, lat: 42.00430265307896 };

  const verticalOffset = useMemo(() => pitch * 0.9, [pitch]);
  const popupOffset = useMemo(
    () => [0, -95 + verticalOffset * 1.5],
    [verticalOffset],
  );

  return (
    <>
      <Marker
        longitude={position.lng}
        latitude={position.lat}
        anchor="bottom"
        onClick={() => setShowPopup(!showPopup)}
      >
        <CreditMarkerIcon
          viewBox={MARKER_VIEWBOX}
          aria-label="credit marker"
          $verticalOffset={verticalOffset}
        >
          <path
            d={CREDIT_MARKER_PATH}
            stroke="white"
            strokeWidth="80"
            strokeLinejoin="round"
            paintOrder="stroke fill"
          />
        </CreditMarkerIcon>
      </Marker>

      {showPopup && (
        <Popup
          longitude={position.lng}
          latitude={position.lat}
          anchor="bottom"
          onClose={() => setShowPopup(false)}
          closeOnClick={false}
          offset={popupOffset}
          maxWidth="280px"
        >
          <CreditPopup>
            <Box
              sx={{
                p: 3,
                pt: 4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Typography
                variant="h6"
                fontWeight="bold"
                textAlign="center"
                lineHeight={1.2}
              >
                Оброк
              </Typography>

              <img
                src={creditPopupIcon}
                className="credit-popup-icon"
                alt="creditIcon"
                style={{ width: 80, height: 80 }}
              />

              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
                sx={{ mt: 1 }}
              >
                <strong>Оброк</strong>, развиен од{" "}
                <Typography
                  component="span"
                  variant="body2"
                  color="primary.main"
                  fontWeight="bold"
                >
                  Мартин Трифунов
                </Typography>
                . Оброк е модерна веб апликација дизајнирана да им помогне на
                студентите да пронајдат пристапни и буџетски понуди за оброци во
                нивна близина преку интерактивна 3D мапа.
              </Typography>
            </Box>
          </CreditPopup>
        </Popup>
      )}
    </>
  );
};

const CreditMarkerIcon = styled("svg")(({ $verticalOffset = 0 }) => ({
  width: 38,
  height: 95,
  display: "block",
  cursor: "pointer",
  color: "#9c27b0",
  fill: "currentColor",
  transform: `translateY(${$verticalOffset}px)`,
  transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
  animation: "markerDrop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
  "&:hover": {
    transform: `translateY(${$verticalOffset}px) scale(1.1)`,
    filter: `drop-shadow(0 0 12px #9c27b0)`,
  },
  "&:active": {
    transform: `translateY(${$verticalOffset}px) scale(0.95)`,
  },
  "@keyframes markerDrop": {
    "0%": {
      opacity: 0,
      transform: `translateY(${$verticalOffset - 50}px) scale(0.3)`,
    },
    "50%": { transform: `translateY(${$verticalOffset + 5}px) scale(1.05)` },
    "100%": {
      opacity: 1,
      transform: `translateY(${$verticalOffset}px) scale(1)`,
    },
  },
}));

const CreditPopup = styled(Box)(() => ({
  display: "flex",
  width: "100%",
}));

export default CreditMarker;
