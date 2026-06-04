using System;
using System.Web;

using ASC.Data.Storage;
using ASC.Web.Core.Files;
using ASC.Web.Studio.Utility;

namespace ASC.Web.OpportunityBoard.Classes
{
    public class PathProvider
    {
        public static readonly string BaseVirtualPath;
        public static readonly string BaseAbsolutePath;

        static PathProvider()
        {
            BaseVirtualPath = "~/Products/OpportunityBoard/";
            try
            {
                BaseAbsolutePath = CommonLinkUtility.ToAbsolute(BaseVirtualPath);
            }
            catch (Exception)
            {
                BaseAbsolutePath = BaseVirtualPath;
            }
        }

        public static string GetFileStaticRelativePath(string fileName)
        {
            var ext = FileUtility.GetFileExtension(fileName);
            switch (ext)
            {
                case ".js":
                    return VirtualPathUtility.ToAbsolute("~/Products/OpportunityBoard/js/" + fileName);
                case ".png":
                    return WebPath.GetPath("/Products/OpportunityBoard/App_Themes/default/images/" + fileName);
                case ".ascx":
                    return CommonLinkUtility.ToAbsolute("~/Products/OpportunityBoard/Controls/" + fileName);
                case ".css":
                    return VirtualPathUtility.ToAbsolute("~/Products/OpportunityBoard/App_Themes/default/css/" + fileName);
            }
            return fileName;
        }
    }
}