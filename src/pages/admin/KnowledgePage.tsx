import { useState, useEffect, useCallback } from "react";
import { Upload, FileText, Trash2, Loader2, RefreshCw, Plus, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface VapiFile {
  id: string;
  name: string | null;
  originalName: string | null;
  bytes: number | null;
  mimetype: string | null;
  status: "processing" | "done" | "failed" | null;
  createdAt: string;
}

interface KnowledgeBase {
  provider: string;
  name: string;
  description: string;
  fileIds: string[];
}

const KnowledgePage = () => {
  const { toast } = useToast();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [allFiles, setAllFiles] = useState<VapiFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingTo, setUploadingTo] = useState<string | null>(null);
  const [expandedKBs, setExpandedKBs] = useState<Set<string>>(new Set());
  const [deletingFile, setDeletingFile] = useState<{ kbName: string; fileId: string } | null>(null);
  
  // Create KB dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKBName, setNewKBName] = useState("");
  const [newKBDescription, setNewKBDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchKnowledgeBases = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("vapi-knowledge-tool", {
        body: { action: "get" },
      });

      if (error) throw error;

      if (data?.knowledgeBases) {
        setKnowledgeBases(data.knowledgeBases);
        // Expand all by default
        setExpandedKBs(new Set(data.knowledgeBases.map((kb: KnowledgeBase) => kb.name)));
      }
    } catch (error) {
      console.error("Failed to fetch knowledge bases:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load knowledge bases.",
      });
    }
  }, [toast]);

  const fetchAllFiles = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("vapi-files", {
        body: { action: "list" },
      });

      if (error) throw error;

      if (data?.files) {
        setAllFiles(data.files);
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchKnowledgeBases(), fetchAllFiles()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchKnowledgeBases, fetchAllFiles]);

  const handleCreateKnowledgeBase = async () => {
    if (!newKBName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a name for the knowledge base.",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-knowledge-tool", {
        body: {
          action: "createKnowledgeBase",
          name: newKBName.trim().toLowerCase().replace(/\s+/g, "_"),
          description: newKBDescription.trim() || `Knowledge base for ${newKBName}`,
        },
      });

      if (error) throw error;

      if (data?.knowledgeBases) {
        setKnowledgeBases(data.knowledgeBases);
        setExpandedKBs(new Set(data.knowledgeBases.map((kb: KnowledgeBase) => kb.name)));
      }

      toast({
        title: "Knowledge Base Created",
        description: `"${newKBName}" has been created successfully.`,
      });

      setNewKBName("");
      setNewKBDescription("");
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to create knowledge base:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create knowledge base.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadToKB = async (kbName: string, files: File[]) => {
    if (files.length === 0) return;

    setUploadingTo(kbName);

    try {
      for (const file of files) {
        // Upload file to Vapi
        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileName", file.name);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vapi-file-upload`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Upload failed");
        }

        const data = await response.json();
        
        if (data.file?.id) {
          // Add file to the knowledge base
          const { error } = await supabase.functions.invoke("vapi-knowledge-tool", {
            body: {
              action: "addFile",
              knowledgeBaseName: kbName,
              fileId: data.file.id,
            },
          });

          if (error) throw error;
        }
      }

      toast({
        title: "Files Uploaded",
        description: `${files.length} file(s) uploaded to "${kbName}".`,
      });

      // Refresh data
      await Promise.all([fetchKnowledgeBases(), fetchAllFiles()]);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload files.",
      });
    } finally {
      setUploadingTo(null);
    }
  };

  const handleRemoveFile = async (kbName: string, fileId: string) => {
    setDeletingFile({ kbName, fileId });

    try {
      // Remove file from knowledge base
      const { error } = await supabase.functions.invoke("vapi-knowledge-tool", {
        body: {
          action: "removeFile",
          knowledgeBaseName: kbName,
          fileId: fileId,
        },
      });

      if (error) throw error;

      // Also delete from Vapi files
      await supabase.functions.invoke("vapi-files", {
        body: { action: "delete", fileId },
      });

      toast({
        title: "File Removed",
        description: "File has been removed from the knowledge base.",
      });

      await Promise.all([fetchKnowledgeBases(), fetchAllFiles()]);
    } catch (error) {
      console.error("Remove file error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove file.",
      });
    } finally {
      setDeletingFile(null);
    }
  };

  const getFileInfo = (fileId: string): VapiFile | undefined => {
    return allFiles.find(f => f.id === fileId);
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const toggleKB = (name: string) => {
    const newExpanded = new Set(expandedKBs);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedKBs(newExpanded);
  };

  if (isLoading) {
    return (
      <AdminLayout
        title="Knowledge Base"
        description="Manage knowledge bases for the voice agent's query tool"
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Knowledge Base"
      description="Manage knowledge bases for the voice agent's query tool"
    >
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {knowledgeBases.length} knowledge base(s) configured
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => Promise.all([fetchKnowledgeBases(), fetchAllFiles()])}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New Knowledge Base
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Knowledge Base</DialogTitle>
                  <DialogDescription>
                    Create a new knowledge base to organize related documents.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      placeholder="e.g., product_documentation"
                      value={newKBName}
                      onChange={(e) => setNewKBName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use lowercase with underscores, no spaces
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      placeholder="Describe what this knowledge base contains..."
                      value={newKBDescription}
                      onChange={(e) => setNewKBDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateKnowledgeBase} disabled={isCreating}>
                    {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Knowledge Bases */}
        {knowledgeBases.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold text-foreground mb-2">No Knowledge Bases</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first knowledge base to start uploading documents.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Knowledge Base
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {knowledgeBases.map((kb) => (
              <Collapsible
                key={kb.name}
                open={expandedKBs.has(kb.name)}
                onOpenChange={() => toggleKB(kb.name)}
              >
                <div className="card-elevated overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {expandedKBs.has(kb.name) ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                        <FolderOpen className="w-5 h-5 text-primary" />
                        <div>
                          <h3 className="font-semibold text-foreground">{kb.name}</h3>
                          <p className="text-sm text-muted-foreground">{kb.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {kb.fileIds?.length || 0} file(s)
                        </span>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t border-border">
                      {/* Upload area for this KB */}
                      <div className="p-4 bg-muted/30">
                        <div
                          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                            uploadingTo === kb.name ? "opacity-50 pointer-events-none" : "hover:border-primary/50"
                          }`}
                        >
                          {uploadingTo === kb.name ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Uploading...</span>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground mb-2">
                                Drop files here or click to upload
                              </p>
                              <Button variant="outline" size="sm" asChild>
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    multiple
                                    accept=".pdf,.docx,.txt,.md"
                                    className="hidden"
                                    onChange={(e) =>
                                      e.target.files && handleUploadToKB(kb.name, Array.from(e.target.files))
                                    }
                                  />
                                  Browse Files
                                </label>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Files table */}
                      {kb.fileIds && kb.fileIds.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>File Name</TableHead>
                              <TableHead>Size</TableHead>
                              <TableHead>Uploaded</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {kb.fileIds.map((fileId) => {
                              const fileInfo = getFileInfo(fileId);
                              const isDeleting = deletingFile?.kbName === kb.name && deletingFile?.fileId === fileId;
                              
                              return (
                                <TableRow key={fileId}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-muted-foreground" />
                                      <span className="font-medium">
                                        {fileInfo?.originalName || fileInfo?.name || fileId.slice(0, 8) + "..."}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>{fileInfo ? formatBytes(fileInfo.bytes) : "N/A"}</TableCell>
                                  <TableCell>
                                    {fileInfo ? formatDate(fileInfo.createdAt) : "N/A"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={isDeleting}
                                      onClick={() => handleRemoveFile(kb.name, fileId)}
                                    >
                                      {isDeleting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      )}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="p-6 text-center text-muted-foreground border-t border-border">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No files in this knowledge base</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default KnowledgePage;
