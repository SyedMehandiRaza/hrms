import React from "react";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MdEmail, MdLock } from "react-icons/md";
import { BsGlobe } from "react-icons/bs";
import { useTranslation } from "react-i18next";
import { icons, images } from "../utils/assets";
const AuthLeft = () => {
  const { t } = useTranslation("shared");
  return (
    <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 p-12 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 start-20 w-40 h-40 bg-blue-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 end-20 w-40 h-40 bg-blue-500 rounded-full blur-3xl"></div>
      </div>

      {/* Logo */}
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <img src={icons.applogo} />
          <span className="text-white text-xl font-bold tracking-wide">
            {t("auth.brandName")}
          </span>
        </div>
      </div>

      {/* Center Content */}
      <div className="relative z-10 text-center">
        <div className="mb-8 flex justify-center">
          <div className="relative w-100 h-100">
            {/* Glowing Globe SVG Animation */}
            <img src={images.ContainerImg} className="h-110 w-120"></img>
          </div>
        </div>

        <h2 className="text-4xl font-bold text-white mb-4">
          {t("auth.heroTitle")}
        </h2>
        <p className="text-blue-200 text-lg max-w-sm mx-auto">
          {t("auth.heroSubtitle")}
        </p>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center">
        <p className="text-blue-300 text-xs tracking-widest mb-1">
          {t("auth.edition")}
        </p>
        <p className="text-blue-300 text-xs tracking-widest">
          {t("auth.trustedBy")}
        </p>
      </div>
    </div>
  );
};

export default AuthLeft;
